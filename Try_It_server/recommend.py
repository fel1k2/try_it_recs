from fastapi import HTTPException
from Try_It_bd import (
    get_user_game_interactions, 
    get_game_features, 
    get_user_games_ids,
    get_wishlist_from_db,
    get_blacklist_from_db,
)
import numpy as np
import pickle
import asyncio
import pandas as pd
from surprise import SVD, Dataset, Reader
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import logging
from functools import lru_cache
from typing import List, Dict, Tuple, Optional, Set


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
MODEL_PATH = "model.pkl"
TFIDF_PATH = "tfidf.pkl"
UPDATE_INTERVAL = 24 * 60 * 60
MULTIPLAYER_CATEGORIES = [
    "Co-op",
    "LAN Co-op",
    "LAN PvP",
    "MMO",
    "Multi-player",
    "Online Co-op",
    "Online PvP"
]
cached_model = None
cached_tfidf = None
cached_game_features = None
cached_filtered_games = None


def identity_tokenizer(x):
    return x


def identity_preprocessor(x):
    return x


def filter_games_by_criteria(
    game_features: Dict[str, List[str]],
    tags: Optional[List[str]] = None,
    genres: Optional[List[str]] = None,
    categories: Optional[List[str]] = None
) -> Dict[str, List[str]]:
    if not (tags or genres or categories):
        return game_features
    filtered_games = {}
    for gid, features in game_features.items():
        features_lower = [f.lower() for f in features]
        if (not tags or any(tag.lower() in features_lower for tag in tags)) and \
           (not genres or any(genre.lower() in features_lower for genre in genres)) and \
           (not categories or any(category.lower() in features_lower for category in categories)):
            filtered_games[gid] = features
    return filtered_games


async def get_filtered_game_features(
    tags: Optional[List[str]] = None,
    genres: Optional[List[str]] = None,
    categories: Optional[List[str]] = None
) -> Dict[str, List[str]]:
    global cached_game_features, cached_filtered_games
    if not (tags or genres or categories):
        if cached_game_features is None:
            cached_game_features = await get_game_features()
        return cached_game_features
    cache_key = (tuple(sorted(tags or [])), tuple(sorted(genres or [])), tuple(sorted(categories or [])))
    if cached_filtered_games is None:
        cached_filtered_games = {}
    if cache_key in cached_filtered_games:
        return cached_filtered_games[cache_key]
    if cached_game_features is None:
        cached_game_features = await get_game_features()
    filtered_games = filter_games_by_criteria(cached_game_features, tags, genres, categories)
    cached_filtered_games[cache_key] = filtered_games
    return filtered_games


@lru_cache(maxsize=128)
def get_cached_model():
    global cached_model
    if cached_model is None:
        try:
            with open(MODEL_PATH, "rb") as f:
                cached_model = pickle.load(f)
        except FileNotFoundError:
            return None
    return cached_model


@lru_cache(maxsize=128)
def get_cached_tfidf():
    global cached_tfidf
    if cached_tfidf is None:
        try:
            with open(TFIDF_PATH, "rb") as f:
                cached_tfidf = pickle.load(f)
        except FileNotFoundError:
            return None
    return cached_tfidf


async def collaborative_recommendations(
    user_id: Optional[int] = None,
    n: Optional[int] = 10,
    tags: Optional[List[str]] = None,
    genres: Optional[List[str]] = None,
    categories: Optional[List[str]] = None,
    interactions: Optional[List[Tuple[int, str, float]]] = None,
    filtered_games: Optional[Dict[str, List[str]]] = None,
    force_update: bool = False,
) -> List[Tuple[str, float]]:
    try:
        if filtered_games is None:
            filtered_games = await get_filtered_game_features(tags, genres, categories)
            if not filtered_games:
                return []
        if interactions is None:
            interactions = await get_user_game_interactions()
            if not interactions:
                return []
        if user_id is None:
            user_id = -1
        df = pd.DataFrame(interactions, columns=['user_id', 'game_id', 'playtime'])
        df['normalized_playtime'] = df.groupby('user_id')['playtime'].transform(
            lambda x: (x - x.min()) / (x.max() - x.min()) if x.max() != x.min() else 0.5
        )
        df = df[df['game_id'].isin(filtered_games.keys())]
        if df.empty:
            return []
        reader = Reader(rating_scale=(0, 1))
        data = Dataset.load_from_df(df[['user_id', 'game_id', 'normalized_playtime']], reader)
        trainset = data.build_full_trainset()
        model = get_cached_model()
        if (force_update or model is None):
            logger.info("Training new collaborative model")
            new_model = SVD(n_factors=100, n_epochs=20, lr_all=0.005, reg_all=0.02)
            new_model.fit(trainset)
            with open(MODEL_PATH, "wb") as f:
                pickle.dump(new_model, f)
            model = new_model
        else:
            logger.info("Using cached collaborative model")
        if not force_update:
            user_items = set(item for item, _ in trainset.ur[trainset.to_inner_uid(user_id)])
            testset = [(user_id, game_id, 0) for game_id in filtered_games.keys() 
                    if game_id not in user_items]
            predictions = model.test(testset)
            return sorted(predictions, key=lambda x: x.est, reverse=True)[:n]
    except Exception as e:
        logger.error(f"Error in collaborative recommendations: {str(e)}")
        return []


async def content_recommendations( 
    user_games: Optional[List[str]] = None, 
    n: int = 10, 
    tags: Optional[List[str]] = None, 
    genres: Optional[List[str]] = None, 
    categories: Optional[List[str]] = None,
    filtered_games: Optional[Dict[str, List[str]]] = None,
    force_update: bool = False,
) -> List[Tuple[str, float]]:
    try:
        if filtered_games is None:
            filtered_games = await get_filtered_game_features(tags, genres, categories)
            if not filtered_games:
                return []
        
        vectorizer = get_cached_tfidf()
        if (force_update or vectorizer is None):
            logger.info("Creating new TF-IDF vectorizer")
            new_vectorizer = TfidfVectorizer(
                analyzer='word',
                tokenizer=identity_tokenizer,
                preprocessor=identity_preprocessor,
                token_pattern=None
            )
            all_features = [filtered_games[gid] for gid in filtered_games]
            new_vectorizer.fit(all_features)
            with open(TFIDF_PATH, "wb") as f:
                pickle.dump(new_vectorizer, f)
            vectorizer = new_vectorizer
        else:
            logger.info("Using cached TF-IDF vectorizer")
        if not force_update:
            user_games_filtered = [gid for gid in user_games if gid in filtered_games]
            if not user_games_filtered:
                return []
            all_features = [filtered_games[gid] for gid in filtered_games]
            tfidf_matrix = vectorizer.transform(all_features).toarray()
            user_games_indices = [list(filtered_games.keys()).index(gid) for gid in user_games_filtered]
            user_profile = np.mean(tfidf_matrix[user_games_indices], axis=0)
            cosine_similarities = cosine_similarity(user_profile.reshape(1, -1), tfidf_matrix).flatten()
            recommendations = [
                (game_id, float(score))
                for idx, (game_id, score) in enumerate(zip(filtered_games.keys(), cosine_similarities))
                if game_id not in user_games
            ]
            return sorted(recommendations, key=lambda x: x[1], reverse=True)[:n]    
    except Exception as e:
        logger.error(f"Error in content recommendations: {str(e)}")
        return []


async def hybrid_recommendations(
    login: str,
    user_id: int, 
    n: int = 10, 
    tags: Optional[List[str]] = None, 
    genres: Optional[List[str]] = None, 
    categories: Optional[List[str]] = None,
    friend_id: Optional[int] = None
) -> List[Tuple[str, float]]:
    try:
        if friend_id is not None:
            filtered_games = await get_multiplayer_games()
            if not filtered_games:
                return []
            user_games, friend_games = await asyncio.gather(
                get_user_games_ids(user_id),
                get_user_games_ids(friend_id)
            )
            friend_interactions = None
            if friend_games and isinstance(friend_games[0], tuple):
                friend_interactions = [(-1, game_id, playtime) for game_id, playtime in friend_games]
                friend_games = [game_id for game_id, _ in friend_games]
            print(f"friend:{friend_interactions}")
            virtual_interactions = await create_virtual_user_interactions(user_id, friend_id, friend_interactions)
            print(f"virtual:{virtual_interactions}")
            blacklist = await get_blacklist_from_db(login)
            user_game_ids = [game_id for game_id, _ in user_games] if user_games and isinstance(user_games[0], tuple) else user_games
            excluded_games = set(user_game_ids) | set(friend_games)
            if blacklist:
                excluded_games |= set(blacklist)
            collab_recs, content_recs = await asyncio.gather(
                asyncio.wait_for(collaborative_recommendations(interactions=virtual_interactions, filtered_games=filtered_games, n=n), timeout=10.0),
                asyncio.wait_for(content_recommendations(user_games=user_game_ids + friend_games, filtered_games=filtered_games, n=n), timeout=10.0)
            )
        else:
            filtered_games = await get_filtered_game_features(tags, genres, categories)
            if not filtered_games:
                return []
            user_games, wishlist, blacklist = await asyncio.gather(
                get_user_games_ids(user_id),
                get_wishlist_from_db(login),
                get_blacklist_from_db(login)
            )
            user_game_ids = [game_id for game_id, _ in user_games] if user_games and isinstance(user_games[0], tuple) else user_games
            excluded_games = set(user_game_ids)
            if wishlist:
                excluded_games |= set(wishlist)
            if blacklist:
                excluded_games |= set(blacklist)
            collab_recs, content_recs = await asyncio.gather(
                asyncio.wait_for(collaborative_recommendations(user_id, n, tags, genres, categories), timeout=10.0),
                asyncio.wait_for(content_recommendations(user_games=user_game_ids, n=n, tags=tags, genres=genres, categories=categories), timeout=10.0)
            )
        if not collab_recs and not content_recs:
            return []
        COLLAB_WEIGHT = 0.5
        CONTENT_WEIGHT = 0.5
        final_scores = {}
        if collab_recs:
            collab_scores = [rec.est for rec in collab_recs]
            min_collab = min(collab_scores)
            max_collab = max(collab_scores)
            collab_range = max_collab - min_collab if max_collab != min_collab else 1.0
            for rec in collab_recs:
                normalized_score = ((rec.est - min_collab) / collab_range) * COLLAB_WEIGHT
                if rec.iid in excluded_games:
                    continue
                final_scores[rec.iid] = normalized_score
        if content_recs:
            content_scores = [score for _, score in content_recs]
            min_content = min(content_scores)
            max_content = max(content_scores)
            content_range = max_content - min_content if max_content != min_content else 1.0
            for game_id, score in content_recs:
                if game_id in excluded_games:
                    continue
                normalized_score = ((score - min_content) / content_range) * CONTENT_WEIGHT
                if game_id in final_scores:
                    final_scores[game_id] += normalized_score
                else:
                    final_scores[game_id] = normalized_score
        result = sorted(final_scores.items(), key=lambda x: x[1], reverse=True)[:n]
        if result:
            final_scores = [score for _, score in result]
            min_final = min(final_scores)
            max_final = max(final_scores)
            final_range = max_final - min_final if max_final != min_final else 1.0
            result = [
                (game_id, ((score - min_final) / final_range))
                for game_id, score in result
            ]
        return result
    except asyncio.TimeoutError:
        logger.error("Recommendation generation timed out")
        return []
    except Exception as e:
        logger.error(f"Error in hybrid recommendations: {str(e)}")
        return []


async def get_multiplayer_games() -> Dict[str, List[str]]:
    game_features = await get_game_features()
    multiplayer_games = {}
    for game_id, features in game_features.items():
        if any(category in features for category in MULTIPLAYER_CATEGORIES):
            multiplayer_games[game_id] = features
    return multiplayer_games


async def create_virtual_user_interactions(
    user_id: int,
    friend_id: int,
    friend_interactions: Optional[List[Tuple[int, str, float]]] = None
) -> List[Tuple[int, str, float]]:
    all_interactions = await get_user_game_interactions()
    user_interactions = [(uid, gid, pt) for uid, gid, pt in all_interactions if uid == user_id]
    if friend_interactions is None:
        friend_interactions = [(uid, gid, pt) for uid, gid, pt in all_interactions if uid == friend_id]
    friend_games = {game_id: playtime for _, game_id, playtime in friend_interactions}
    user_games = {game_id: playtime for _, game_id, playtime in user_interactions}
    virtual_interactions = []
    virtual_user_id = -1
    all_games = set(user_games.keys()) | set(friend_games.keys())
    for game_id in all_games:
        if game_id in user_games and game_id in friend_games:
            avg_playtime = (user_games[game_id] + friend_games[game_id]) / 2
            virtual_interactions.append((virtual_user_id, game_id, avg_playtime))
        elif game_id in user_games:
            virtual_interactions.append((virtual_user_id, game_id, user_games[game_id] / 2))
        else:
            virtual_interactions.append((virtual_user_id, game_id, friend_games[game_id] / 2))
    return virtual_interactions
