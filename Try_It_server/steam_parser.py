from bs4 import BeautifulSoup
import aiohttp
import re
import asyncio
import random


APP_URL = "https://store.steampowered.com/app/"


async def parse_game (app_id):
    try:
        await asyncio.sleep(random.uniform(1, 2))
        headers = {
            "User-Agent": "Mozilla/5.0 ((Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36)"    
        }
        url = APP_URL + str(app_id) + "/?l=english"
        async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status != 200:
                        print(f"Error while loading page {app_id}: {response.status}")
                        return None
                    soup = BeautifulSoup(await response.text(), "html.parser")
                    dlc = soup.find("a", class_="game_area_details_specs_ctn")
                    if dlc and ("Доп. контент" in dlc.text or "ico_dlc.png" in str(dlc)):
                        return None
                    title = soup.find("div", class_="apphub_AppName").text.strip()
                    description = soup.find("div", class_="game_description_snippet").text.strip()
                    image_url = None
                    for container_class in ["game_header_image_full", "game_header_image_ctn"]:
                        image_div = soup.find("div", class_=container_class)
                        if image_div:
                            img = image_div.find("img")
                            if img and img.get("src"):
                                image_url = img["src"]
                                break
                    rating = 0
                    rating_div = soup.find("div", class_="nonresponsive_hidden responsive_reviewdesc")
                    if not rating_div:
                        rating_div = soup.find("div", class_="user_reviews_summary_row")
                    if rating_div:
                        rating_text = rating_div.text.strip()
                        match = re.search(r'(\d+)%', rating_text)
                        if match:
                            rating = int(match.group(1))
                    features = []
                    for feature in soup.find_all("a", class_="game_area_details_specs_ctn"):
                        label = feature.find("div", class_="label")
                        if label:
                            features.append(label.text.strip())
                    genres_block = None
                    for genre_label in ["Жанр:", "Genre:"]:
                        genre_b = soup.find("b", text=genre_label)
                        if genre_b:
                            genres_block = genre_b.find_next("span")
                            break
                    genres = []
                    if genres_block:
                        genres_text = genres_block.text.strip()
                        genres = [genre.strip() for genre in genres_text.split(',')]
                    tags = [tag.text.strip() for tag in soup.find_all("a", class_="app_tag")]
                    game_data = {
                        "appid": app_id,
                        "title": title,
                        "description": description,
                        "image_url": image_url,
                        "rating": rating,
                        "genres": genres,
                        "tags": tags,
                        "features": features
                    }
                    return game_data
    except Exception as e:
        print(f"Error in parse_game: {str(e)}")
        return None
