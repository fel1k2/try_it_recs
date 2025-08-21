import aiohttp
from fastapi import HTTPException
import asyncio
import random
import functools
import logging


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


API_KEY = "***********"
STEAM_API_URL = "http://api.steampowered.com"


def retry_on_error(max_retries=10, delay=2):
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except HTTPException as e:
                    if e.status_code == 409 and "invalid Steam ID" in str(e.detail):
                        attempt = max_retries
                        print(f"invalid Steam ID: {e.detail}")
                        raise HTTPException(status_code=409, detail='invalid Steam ID')
                    if e.status_code == 409 and "No such player" in str(e.detail):
                        raise
                    last_exception = e
                    if attempt < max_retries - 1:
                        wait_time = delay * (attempt + 1)
                        logger.warning(f"Attempt {attempt + 1} failed for {func.__name__}, retrying in {wait_time} seconds...")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"All {max_retries} attempts failed for {func.__name__}")
                        raise last_exception
            return await func(*args, **kwargs)
        return wrapper
    return decorator


@retry_on_error(max_retries=10, delay=2)
async def get_app_list():
    try:
        await asyncio.sleep(random.uniform(1, 2))
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{STEAM_API_URL}/ISteamApps/GetAppList/v2/") as response:
                if response.status != 200:
                    raise HTTPException(status_code=409, detail='SteamAPI error')
                return await response.json()
    except Exception as exc:
        raise HTTPException(status_code=409, detail='SteamAPI error, exception: ' + str(exc))


@retry_on_error(max_retries=10, delay=2)
async def get_nickname(SteamID64):
    try:
        await asyncio.sleep(random.uniform(1, 2))
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{STEAM_API_URL}/ISteamUser/GetPlayerSummaries/v0002/",
                params={"key": API_KEY, "steamids": SteamID64}
            ) as response:
                if response.status != 200:
                    raise HTTPException(status_code=409, detail='SteamAPI error')
                data = await response.json()
                players = data['response'].get('players', [])
                if not players:
                    raise HTTPException(status_code=409, detail='invalid Steam ID')
                return str(players[0]['personaname'])
    except Exception as exc:
        raise HTTPException(status_code=409, detail='Closed Steam profile or SteamAPI error or wrong SteamID64, exception: ' + str(exc))


@retry_on_error(max_retries=10, delay=2)
async def get_games(SteamID64):
    try:
        await asyncio.sleep(random.uniform(1, 2))
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{STEAM_API_URL}/IPlayerService/GetOwnedGames/v0001/",
                params={
                    "key": API_KEY,
                    "steamid": SteamID64,
                    "include_played_free_games": 1,
                    "format": "json"
                }
            ) as response:
                if response.status != 200:
                    raise HTTPException(status_code=409, detail='SteamAPI error')
                return await response.json()
    except Exception as exc:
        raise HTTPException(status_code=409, detail='SteamAPI error, exception: ' + str(exc))


@retry_on_error(max_retries=10, delay=2)
async def get_friends(SteamID64):
    try:
        await asyncio.sleep(random.uniform(1, 2))
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{STEAM_API_URL}/ISteamUser/GetFriendList/v0001/",
                params={
                    "key": API_KEY,
                    "steamid": SteamID64,
                    "relationship": "friend"
                }
            ) as response:
                if response.status != 200:
                    raise HTTPException(status_code=409, detail='SteamAPI error')
                return await response.json()
    except Exception as exc:
        raise HTTPException(status_code=409, detail='SteamAPI error, exception: ' + str(exc))
