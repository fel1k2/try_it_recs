import uvicorn
import bcrypt
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from recommend import collaborative_recommendations, content_recommendations, hybrid_recommendations
from Try_It_bd import (
    create_user,
    get_user_by_login,
    get_friends_from_db,
    get_game_info_from_db,
    get_genres_tags_features_from_db,
    get_short_game_info_from_db,
    get_wishlist_from_db,
    get_blacklist_from_db,
    add_to_wishlist_in_db,
    add_to_blacklist_in_db,
    remove_from_wishlist_in_db,
    remove_from_blacklist_in_db,
    update_all_data
)
from pydantic import BaseModel
from auth import create_access_token, create_refresh_token, verify_token
from typing import List, Optional
from fastapi import Query
from datetime import datetime, timedelta


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://tryitrecommendations.ru"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


last_update_time = datetime.now()


async def periodic_update():
    global last_update_time
    while True:
        try:
            current_time = datetime.now()
            if last_update_time is None or (current_time - last_update_time) >= timedelta(days=7):
                print("Starting weekly data update...")
                await update_all_data()
                last_update_time = current_time
                await asyncio.gather(
                    collaborative_recommendations(force_update=True),
                    content_recommendations(force_update=True)
                )
                print("Weekly update completed")
            asyncio.create_task(asyncio.sleep(24 * 60 * 60))
            return
        except Exception as e:
            print(f"Error in periodic_update: {str(e)}")
            asyncio.create_task(asyncio.sleep(60 * 60))
            return


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(periodic_update())


class User_Register(BaseModel):
    login: str
    password: str
    steamid64: str


class User_Login(BaseModel):
    login: str
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


if __name__ == '__main__':
    uvicorn.run(
        "Try_It_server:app", 
        host="0.0.0.0", 
        port=443, 
        reload=True, 
        ssl_keyfile="C:\\ProgramData\\win-acme\\acme-v02.api.letsencrypt.org\\tryitrecommendations.ru-key.pem", 
        ssl_certfile="C:\\ProgramData\\win-acme\\acme-v02.api.letsencrypt.org\\tryitrecommendations.ru-chain.pem"
    )


@app.get('/recommend')
async def get_recommendation(
    token: str,
    tags: Optional[List[str]] = Query(None),
    genres: Optional[List[str]] = Query(None),
    categories: Optional[List[str]] = Query(None),
    friend_steam_id: Optional[str] = Query(None)
):
    payload = verify_token(token, token_type="access")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid access token")
    db_user = await get_user_by_login(payload["sub"])
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    user_id = str(db_user["SteamID64"])
    login = str(db_user["login"])
    print(f"genres: {genres}")
    print(f"categories: {categories}")
    recommendations = await hybrid_recommendations(
        login,
        user_id, 
        n=100, 
        tags=tags, 
        genres=genres, 
        categories=categories,
        friend_id=friend_steam_id
    )
    result = []
    for rec in recommendations:
        game_id, score = rec
        game_info = await get_short_game_info_from_db(game_id)
        if game_info:
            game_info["score"] = score
            result.append(game_info)
    return {"recommendations": result}


@app.get('/get-wishlist')
async def get_wishlist(token: str):
    payload = verify_token(token, token_type="access")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid access token")
    db_user = await get_user_by_login(payload["sub"])
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    login = str(db_user["login"])
    wishlist = await get_wishlist_from_db(login)
    result = []
    for game in wishlist:
        game_info = await get_short_game_info_from_db(game)
        result.append(game_info)
    return {"wishlist": result}


@app.get('/get-blacklist')
async def get_blacklist(token: str):
    payload = verify_token(token, token_type="access")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid access token")
    db_user = await get_user_by_login(payload["sub"])
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    login = str(db_user["login"])
    blacklist = await get_blacklist_from_db(login)
    result = []
    for game in blacklist:
        game_info = await get_short_game_info_from_db(game)
        result.append(game_info)
    return {"blacklist": result}


@app.post('/add-to-wishlist')
async def add_to_wishlist(token: str, game_id: str):
    payload = verify_token(token, token_type="access")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid access token")
    db_user = await get_user_by_login(payload["sub"])
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    login = str(db_user["login"])
    await add_to_wishlist_in_db(login, game_id)
    return {"message": "Game added to wishlist"}


@app.post('/add-to-blacklist')
async def add_to_blacklist(token: str, game_id: str):
    payload = verify_token(token, token_type="access")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid access token")
    db_user = await get_user_by_login(payload["sub"])
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    login = str(db_user["login"])
    await add_to_blacklist_in_db(login, game_id)
    return {"message": "Game added to blacklist"}


@app.post('/remove-from-wishlist')
async def remove_from_wishlist(token: str, game_id: str):
    payload = verify_token(token, token_type="access")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid access token")
    db_user = await get_user_by_login(payload["sub"])
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    login = str(db_user["login"])
    await remove_from_wishlist_in_db(login, game_id)
    return {"message": "Game removed from wishlist"}


@app.post('/remove-from-blacklist')
async def remove_from_blacklist(token: str, game_id: str):
    payload = verify_token(token, token_type="access")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid access token")
    db_user = await get_user_by_login(payload["sub"])
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    login = str(db_user["login"])
    await remove_from_blacklist_in_db(login, game_id)
    return {"message": "Game removed from blacklist"}


@app.post("/register", status_code=201)
async def register_user(user: User_Register):
    try:
        await create_user(user.login, user.password, user.steamid64)
        await asyncio.gather(
            collaborative_recommendations(force_update=True),
            content_recommendations(force_update=True)
        )
        return {"message": "User created successfully"}
    except HTTPException as err:
        print(f"Error in register_user: {err.detail}")
        raise err


@app.post('/login')
async def login_user(user: User_Login):
    try:
        print(f"Attempting login for user: {user.login}")
        db_user = await get_user_by_login(user.login)
        if not db_user:
            print(f"User not found: {user.login}")
            raise HTTPException(status_code=409, detail="wrong login or password")
        if not bcrypt.checkpw(user.password.encode('utf-8'), db_user["password"]):
            print(f"Invalid password for user: {user.login}")
            raise HTTPException(status_code=409, detail="wrong login or password")
        access_token = create_access_token({"sub": db_user["login"]})
        refresh_token = create_refresh_token({"sub": db_user["login"]})
        print(f"Successful login for user: {user.login}")
        return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}
    except HTTPException as err:
        print(f"Error in login_user: {err.detail}")
        raise err


@app.post('/refresh-access')
async def refresh_access_token(data: RefreshTokenRequest):
    payload = verify_token(data.refresh_token, token_type="refresh")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    access_token = create_access_token({"sub": payload["sub"]})
    return {"access_token": access_token, "token_type": "bearer"}


@app.post('/refresh-token')
async def update_refresh_token(data: RefreshTokenRequest):
    payload = verify_token(data.refresh_token, token_type="refresh")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    refresh_token = create_refresh_token({"sub": payload["sub"]})
    return {"refresh_token": refresh_token, "token_type": "bearer"}


@app.get('/get-friends')
async def get_friends(token: str):
    payload = verify_token(token, token_type="access")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid access token")
    db_user = await get_user_by_login(payload["sub"])
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    user_id = str(db_user["SteamID64"])
    return {"friends": await get_friends_from_db(user_id)}
    

@app.get('/get-game-info')
async def get_game_info(token: str, game_id: str):
    payload = verify_token(token, token_type="access")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid access token")
    db_user = await get_user_by_login(payload["sub"])
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return await get_game_info_from_db(game_id)


@app.get('/get-genres-tags-features')
async def get_genres_tags_features(token: str):
    payload = verify_token(token, token_type="access")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid access token")
    db_user = await get_user_by_login(payload["sub"])
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return await get_genres_tags_features_from_db()
