
# -------- Wi-Fi network credentials ----------
def ssid():
    return "VictoryRoyale"

def password():
    return "ChristIsKing"


# -------- Website host IP adress ----------
def url():
    pc_ip = "10.111.29.5"
    port = 8001
    api_key = "E9Y2LxT4g1hQZ7aD8nR3mWx5P0qK6pV7"
    desk_id = "ee:62:5b:b8:73:1d"
    _url = f"http://{pc_ip}:{port}/api/v2/{api_key}/desks/{desk_id}"
    return _url
