from fastapi import HTTPException
import psycopg
from psycopg.rows import dict_row
import bcrypt
from test_steamAPI import get_nickname, get_games, get_friends, get_app_list
from steam_parser import parse_game
import traceback
from datetime import datetime
import asyncio


db_config = {
    "dbname": "Try_It_db",
    "user": "postgres",
    "password": "ari100tel",
    "host": "localhost",
    "port": 5432
    }


async def update_user_data(steamid64: str):
    try:
        games = await get_games(steamid64)
        friends = await get_friends(steamid64)
        await insert_games(games, steamid64)
        await insert_friends(friends, steamid64)
        print(f"Successfully updated data for user {steamid64}")
    except Exception as e:
        print(f"Error updating data for user {steamid64}: {str(e)}")


async def update_all_data():
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                                  SELECT "SteamID64" FROM try_it."Steam_User"
                                  """)
                users = await cur.fetchall()
                for user in users:
                    await update_user_data(user["SteamID64"])
                    await asyncio.sleep(2)
                await update_games()
    except Exception as e:
        print(f"Error in update_all_users_data: {str(e)}")


async def update_games():
    try:
        games_data = await get_app_list()
        if not games_data or 'applist' not in games_data or 'apps' not in games_data['applist']:
            print("Error: Invalid response from Steam API")
            return
        games = games_data['applist']['apps']
        for game in games:
            try:
                appid = str(game['appid'])
                conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
                async with conn:
                    async with conn.cursor() as cur:
                        await cur.execute("""
                                          SELECT 1 FROM try_it."game" WHERE "GameID" = %s
                                          """, (appid, ))
                        exists = await cur.fetchone()
                        if not exists:
                            game_data = await parse_game(appid)
                            if game_data:
                                await insert_game(game_data)
                            await asyncio.sleep(1)
            except Exception as game_err:
                print(f"Error processing game {game.get('appid')}: {str(game_err)}")
                continue
    except Exception as e:
        print(f"Error in update_games: {str(e)}")
        traceback.print_exc()


async def get_all_game_ids():
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                                  SELECT "GameID" FROM try_it."game"
                                  """)
                rows = await cur.fetchall()
                return [row["GameID"] for row in rows]
    except psycopg.Error as err:
        print("DB error in get_all_game_ids:", err)
        return []


async def get_friends_from_db(steamid64: str):
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                                  WITH target_user AS (
                                      SELECT %s AS "SteamID64"
                                  ),
                                  registered_friends_list AS (
                                      SELECT 
                                          CASE 
                                              WHEN rf."max_SteamID64" = tu."SteamID64" THEN rf."min_SteamID64"
                                              ELSE rf."max_SteamID64"
                                          END AS friend_id
                                      FROM try_it."registered_friends" rf
                                      JOIN target_user tu ON rf."max_SteamID64" = tu."SteamID64" OR rf."min_SteamID64" = tu."SteamID64"
                                  ),
                                  registered_friends_named AS (
                                      SELECT su."SteamID64", su."nickname"
                                      FROM try_it."Steam_User" su
                                      JOIN registered_friends_list rfl ON su."SteamID64" = rfl.friend_id
                                  ),
                                  unregistered_friends_named AS (
                                      SELECT ur."SteamID64", ur."nickname"
                                      FROM try_it."unregistered_friends" uf
                                      JOIN target_user tu ON uf."registered_SteamID64" = tu."SteamID64"
                                      JOIN try_it."unregistered" ur ON ur."SteamID64" = uf."unregistered_SteamID64"
                                  )
                                  SELECT "SteamID64", "nickname" FROM registered_friends_named
                                  UNION
                                  SELECT "SteamID64", "nickname" FROM unregistered_friends_named
                                  """, (steamid64, ))
                rows = await cur.fetchall()
                return [(row["SteamID64"], row["nickname"]) for row in rows]
    except psycopg.Error as err:
        print("DB error in get_friends_from_db:", err)
        return []


async def get_wishlist_from_db(login: str):
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                                  SELECT "GameID", "date_added" FROM try_it."wishlist" WHERE "login" = %s
                                  """, (login, ))
                rows = await cur.fetchall()
                return [row["GameID"] for row in rows]
    except psycopg.Error as err:
        print("DB error in get_wishlist_from_db:", err)
        return []
    

async def add_to_wishlist_in_db(login: str, game_id: str):
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                                  INSERT INTO try_it."wishlist" ("login", "GameID", "date_added")
                                  VALUES (%s, %s, %s)
                                  ON CONFLICT ("login", "GameID") DO NOTHING
                                  """, (login, game_id, datetime.now(), ))
                await conn.commit()
    except psycopg.Error as err:
        print("DB error in add_to_wishlist_in_db:", err)
        return []
    

async def remove_from_wishlist_in_db(login: str, game_id: str):
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                                  DELETE FROM try_it."wishlist" WHERE "login" = %s AND "GameID" = %s
                                  """, (login, game_id, ))
                await conn.commit()
    except psycopg.Error as err:
        print("DB error in remove_from_wishlist_in_db:", err)
        return []
    

async def get_blacklist_from_db(login: str):
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                                  SELECT "GameID", "date_added" FROM try_it."hidden" WHERE "login" = %s
                                  """, (login, ))
                rows = await cur.fetchall()
                return [row["GameID"] for row in rows]
    except psycopg.Error as err:
        print("DB error in get_blacklist_from_db:", err)
        return []
    

async def add_to_blacklist_in_db(login: str, game_id: str):
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                                  INSERT INTO try_it."hidden" ("login", "GameID", "date_added")
                                  VALUES (%s, %s, %s)
                                  ON CONFLICT ("login", "GameID") DO NOTHING
                                  """, (login, game_id, datetime.now(), ))
                await conn.commit()
    except psycopg.Error as err:
        print("DB error in add_to_blacklist_in_db:", err)
        return []
    

async def remove_from_blacklist_in_db(login: str, game_id: str):
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                                  DELETE FROM try_it."hidden" WHERE "login" = %s AND "GameID" = %s
                                  """, (login, game_id, ))
                await conn.commit()
    except psycopg.Error as err:
        print("DB error in remove_from_blacklist_in_db:", err)
        return []
    

async def get_short_game_info_from_db(game_id: str):
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                                  SELECT "GameID", "game_title", "image_url", "rating" FROM try_it."game" WHERE "GameID" = %s
                                  """, (game_id, ))
                row = await cur.fetchone()
                return row
    except psycopg.Error as err:
        print("DB error in get_short_game_info_from_db:", err)
        return None


async def get_game_info_from_db(game_id: str):
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                                  WITH target_game AS (
                                      SELECT * FROM try_it."game" WHERE "GameID" = %s
                                  ),
                                  game_tags AS (
                                      SELECT t."tag"
                                      FROM try_it."tags" tg
                                      JOIN try_it."tag" t ON tg."tagID" = t."tagID"
                                      WHERE tg."gameID" = %s
                                  ),
                                  game_genres AS (
                                      SELECT g.genre
                                      FROM try_it."genres" gr
                                      JOIN try_it."genre" g ON gr."genreID" = g."genreID"
                                      WHERE gr."gameID" = %s
                                  ),
                                  game_features AS (
                                      SELECT f."feature"
                                      FROM try_it."features" fs
                                      JOIN try_it."feature" f ON fs."featureID" = f."featureID"
                                      WHERE fs."gameID" = %s
                                  )
                                  SELECT 
                                      g.*,
                                      ARRAY(SELECT "tag" FROM game_tags) AS tags,
                                      ARRAY(SELECT "genre" FROM game_genres) AS genres,
                                      ARRAY(SELECT "feature" FROM game_features) AS features
                                  FROM target_game g
                                  """, (game_id, game_id, game_id, game_id, ))
                row = await cur.fetchone()
                return row
    except psycopg.Error as err:
        print("DB error in get_game_info_from_db:", err)
        return None


async def get_genres_tags_features_from_db():
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                                  SELECT
                                    ARRAY(SELECT "tag" FROM try_it."tag" ORDER BY "tag")     AS tags,
                                    ARRAY(SELECT "genre" FROM try_it."genre" ORDER BY "genre")   AS genres,
                                    ARRAY(SELECT "feature" FROM try_it."feature" ORDER BY "feature") AS features
                                  """)
                rows = await cur.fetchall()
                return rows
    except psycopg.Error as err:
        print("DB error in get_genres_tags_features_from_db:", err)
        return None


async def insert_game(game_data):
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                                  INSERT INTO try_it.game ("GameID", game_title, description, image_url, rating)
                                  VALUES (%s, %s, %s, %s, %s)
                                  ON CONFLICT ("GameID") DO NOTHING;
                                  """, (game_data["appid"],
                                        game_data["title"],
                                        game_data["description"],
                                        game_data["image_url"],
                                        game_data["rating"]
                ))
                for tag in game_data["tags"]:
                    await cur.execute("""
                                      INSERT INTO try_it.tag (tag)
                                      VALUES (%s)
                                      ON CONFLICT (tag) DO NOTHING
                                      RETURNING "tagID";
                                      """, (tag, ))
                    tag_row = await cur.fetchone()
                    if tag_row:
                        await cur.execute("""
                                          INSERT INTO try_it.tags ("gameID", "tagID")
                                          VALUES (%s, %s)
                                          ON CONFLICT ("gameID", "tagID") DO NOTHING;
                                          """, (game_data["appid"], tag_row["tagID"], ))
                for genre in game_data["genres"]:
                    await cur.execute("""
                                      INSERT INTO try_it.genre (genre)
                                      VALUES (%s)
                                      ON CONFLICT (genre) DO NOTHING
                                      RETURNING "genreID";
                                      """, (genre, ))
                    genre_row = await cur.fetchone()
                    if genre_row:
                        await cur.execute("""
                                          INSERT INTO try_it.genres ("gameID", "genreID")
                                          VALUES (%s, %s)
                                          ON CONFLICT ("gameID", "genreID") DO NOTHING;
                                          """, (game_data["appid"], genre_row["genreID"], ))
                for feature in game_data["features"]:
                    await cur.execute("""
                                      INSERT INTO try_it.feature (feature)
                                      VALUES (%s)
                                      ON CONFLICT (feature) DO NOTHING
                                      RETURNING "featureID";
                                      """, (feature, ))
                    feature_row = await cur.fetchone()
                    if feature_row:
                        await cur.execute("""
                                          INSERT INTO try_it.features ("gameID", "featureID")
                                          VALUES (%s, %s)
                                          ON CONFLICT ("gameID", "featureID") DO NOTHING;
                                          """, (game_data["appid"], feature_row["featureID"], ))
                await conn.commit()
    except psycopg.Error as err:
        print("Error while inserting game into DB:", err)
        traceback.print_exc()


async def create_user(login: str, password: str, steamid64: str):
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                                  SELECT 1 FROM try_it."user" WHERE login = %s
                                  """, (login, ))
                if await cur.fetchone():
                    raise HTTPException(status_code=409, detail="User with this login already exists")
                try:
                    nickname = await get_nickname(steamid64)
                    games = await get_games(steamid64)
                    friends = await get_friends(steamid64)
                except HTTPException as e:
                    if "Invalid Steam ID" in str(e.detail):
                        raise HTTPException(status_code=409, detail="Invalid Steam ID")
                    raise HTTPException(status_code=409, detail=f"Steam API error: {str(e)}")
                await cur.execute("""
                                  SELECT 1 FROM try_it."Steam_User" WHERE "SteamID64" = %s
                                  """, (steamid64, ))
                if not await cur.fetchone():
                    await cur.execute("""
                                      INSERT INTO try_it."Steam_User" ("SteamID64", nickname) VALUES (%s, %s) ON CONFLICT ("SteamID64")
                                      DO UPDATE SET nickname = EXCLUDED.nickname
                                      """, (steamid64, nickname, ))
                hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
                await cur.execute("""
                                  INSERT INTO try_it."user" (login, password, "SteamID64") VALUES (%s, %s, %s)
                                  """, (login, hashed_password, steamid64, ))
                await cur.execute("""
                                  INSERT INTO try_it."registered_friends" ("max_SteamID64", "min_SteamID64")
                                  SELECT GREATEST ("registered_SteamID64", %s) AS max_SteamID64,
                                  LEAST ("registered_SteamID64", %s) AS min_SteamID64
                                  FROM try_it."unregistered_friends" WHERE "unregistered_SteamID64" = %s ON CONFLICT DO NOTHING
                                  """, (steamid64, steamid64, steamid64, ))
                await cur.execute("""
                                  DELETE FROM try_it."unregistered_friends" WHERE "unregistered_SteamID64" = %s
                                  """, (steamid64, ))
                await cur.execute("""
                                  DELETE FROM try_it."unregistered" WHERE "SteamID64" = %s
                                  """, (steamid64, ))
                await conn.commit()
                await insert_games(games, steamid64)
                await insert_friends(friends, steamid64)
    except psycopg.Error as err:
        print("Error while connecting to DB on create_user function:", err)
        raise HTTPException(status_code=500, detail="Database error")


async def insert_games(games, steamid64):
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                for game in games['response'].get("games", []):
                    try:
                        gameID = game['appid']
                        playtime = game.get('playtime_forever', 0)
                        await cur.execute("""
                                          SELECT 1 FROM try_it."game" WHERE "GameID" = %s
                                          """, (str(gameID), ))
                        exists = await cur.fetchone()
                        if not exists:
                            game_data = await parse_game(gameID)
                            if game_data:
                                await insert_game(game_data)
                            await cur.execute("""
                                              SELECT 1 FROM try_it."game" WHERE "GameID" = %s
                                              """, (str(gameID), ))
                            exists = await cur.fetchone()
                            await asyncio.sleep(1)
                        if exists:
                            await cur.execute("""
                                              INSERT INTO try_it."library" ("SteamID64", "GameID", "time_in_game")
                                              VALUES (%s, %s, %s) ON CONFLICT DO NOTHING
                                              """, (steamid64, gameID, playtime))
                        else:
                            print(f"[WARNING] GameID {gameID} not added in DB — probably, game was deleted from Steam.")
                    except Exception as game_err:
                        print(f"[ERROR] Failed to insert game {game.get('appid')} for user {steamid64}: {game_err}")
                        traceback.print_exc()
                await conn.commit()
    except psycopg.Error as err:
        print("[DB ERROR] psycopg error in insert_games:", err)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Database error in 'insert_games' function.")
    except Exception as exc:
        print("[UNEXPECTED ERROR] insert_games:", exc)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Unexpected error in 'insert_games' function.")


async def insert_friends(friends, steamid64):
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                for friend in friends['friendslist'].get("friends", []):
                    try:
                        friend_id = friend.get("steamid")
                        if not friend_id:
                            continue
                        await cur.execute("""
                                          SELECT 1 FROM try_it."user" WHERE "SteamID64" = %s
                                          """, (friend_id, ))
                        is_registered = await cur.fetchone()
                        if is_registered:
                            if steamid64 > friend_id:
                                max_id = steamid64
                                min_id = friend_id
                            else:
                                max_id = friend_id
                                min_id = steamid64
                            await cur.execute("""
                                              INSERT INTO try_it."registered_friends" ("max_SteamID64", "min_SteamID64")
                                              VALUES (%s, %s) ON CONFLICT DO NOTHING
                                              """, (max_id, min_id, ))
                        else:
                            nickname = await get_nickname(friend_id)
                            await cur.execute("""
                                              INSERT INTO try_it."unregistered" ("SteamID64", "nickname") VALUES (%s, %s)
                                              ON CONFLICT ("SteamID64") DO UPDATE SET nickname = EXCLUDED.nickname
                                              """, (friend_id, nickname, ))
                            await cur.execute("""
                                              INSERT INTO try_it."unregistered_friends" ("registered_SteamID64", "unregistered_SteamID64")
                                              VALUES (%s, %s) ON CONFLICT DO NOTHING
                                              """, (steamid64, friend_id, ))
                    except Exception as friend_err:
                        print(f"[ERROR] Failed to process friend {friend.get('steamid')}: {friend_err}")
                        traceback.print_exc()
            await conn.commit()
    except Exception as err:
        print("[ERROR] insert_friends general failure:", err)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error while collecting data in 'insert_friends' function.")


async def get_user_by_login(login:str):
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                                  SELECT login, password, "SteamID64" FROM try_it."user" WHERE login = %s
                                  """, (login, ))
                user = await cur.fetchone()
                return user
    except psycopg.Error as err:
        print("Error while connecting to DB on get_user_by_login function:", err)
        return None


async def get_user_game_interactions():
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                                  SELECT "SteamID64", "GameID", "time_in_game"
                                  FROM try_it."library" WHERE "time_in_game" > 0
                                  """)
                rows = await cur.fetchall()
                return [(row["SteamID64"], row["GameID"], row["time_in_game"]) for row in rows]
    except psycopg.Error as err:
        print("DB error in get_user_game_interactions:", err)
        return []


async def get_user_games_ids(steamid64):
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                                  SELECT 1 FROM try_it."user" WHERE "SteamID64" = %s
                                  """, (steamid64, ))
                if not await cur.fetchone():
                    games_data = await get_games(steamid64)
                    return [(str(game["appid"]), game["playtime_forever"]) 
                           for game in games_data["response"].get("games", [])]
                await cur.execute("""
                                  SELECT "GameID", "time_in_game" FROM try_it."library"
                                  WHERE "SteamID64" = %s
                                  """, (steamid64, ))
                rows = await cur.fetchall()
                return [(row["GameID"], row["time_in_game"]) for row in rows]
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Database error: {str(err)}")


async def get_game_features():
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                                  SELECT "GameID", "rating" FROM try_it."game"
                                  """)
                ratings = {row["GameID"]: row["rating"] for row in await cur.fetchall()}
                await cur.execute("""
                                  SELECT g."gameID", t.tag
                                  FROM try_it."tags" g
                                  JOIN try_it."tag" t ON g."tagID" = t."tagID"
                                  """)
                tag_map = {}
                for row in await cur.fetchall():
                    tag_map.setdefault(row["gameID"], []).append(row['tag'])
                await cur.execute("""
                                  SELECT g."gameID", gen.genre
                                  FROM try_it."genres" g
                                  JOIN try_it."genre" gen ON g."genreID" = gen."genreID"
                                  """)
                genre_map = {}
                for row in await cur.fetchall():
                    genre_map.setdefault(row["gameID"], []).append(row['genre'])
                await cur.execute("""
                                  SELECT g."gameID", f.feature
                                  FROM try_it."features" g
                                  JOIN try_it."feature" f ON g."featureID" = f."featureID"
                                  """)
                category_map = {}
                for row in await cur.fetchall():
                    category_map.setdefault(row["gameID"], []).append(row['feature'])
                game_features = {}
                for appid in ratings:
                    features = []
                    features.append(f"rating:{ratings[appid]}")
                    features.extend(tag_map.get(appid, []))
                    features.extend(genre_map.get(appid, []))
                    features.extend(category_map.get(appid, []))
                    game_features[appid] = features
                return game_features
    except psycopg.Error as err:
        print("Error while fetching game features:", err)
        return []


async def check_user_registered(steamid64: str) -> bool:
    try:
        conn = await psycopg.AsyncConnection.connect(**db_config, row_factory=dict_row)
        async with conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                                  SELECT 1 FROM try_it."user" WHERE "SteamID64" = %s
                                  """, (steamid64, ))
                return await cur.fetchone() is not None
    except Exception as err:
        print(f"Error checking user registration: {str(err)}")
        return False
