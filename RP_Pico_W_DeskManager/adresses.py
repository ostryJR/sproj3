
# -------- Wi-Fi network credentials ----------
def ssid():
    return "" # add WIFI name

def password():
    return "" # add WIFI password


# -------- Website host IP adress ----------
def url():
    pc_ip = "" # add machine/server IP address
    port = 8001 # <-- simulator working port
    api_key = "" # add API key
    desk_id = "ee:62:5b:b8:73:1d" # <-- working example
    _url = f"http://{pc_ip}:{port}/api/v2/{api_key}/desks/{desk_id}"
    return _url
