import network, time, neopixel, gc, urequests
from machine import Pin, I2C, ADC, PWM



# -------- OLED screen object ----------
from PiicoDev_SSD1306 import *
# file downloaded from: https://core-electronics.com.au/guides/raspberry-pi-pico/piicodev-oled-ssd1306-raspberry-pi-pico-guide/ 
Display = create_PiicoDev_SSD1306()



# -------- RGB LED ----------
np = neopixel.NeoPixel(machine.Pin(6), 1)  # 1 LED on GP6
np[0] = (0, 0, 55)  # Blue



# -------- Sensors ----------
button = Pin(10, Pin.IN, Pin.PULL_UP)
light  = ADC(27)                 
lamp = Pin(7, Pin.OUT)
led = Pin("LED", Pin.OUT)
def read_temp():
    v = ADC(4).read_u16() * 3.3 / 65535
    return 27 - (v - 0.706) / 0.001721
buzzer = PWM(Pin(20))
buzzer.freq(1500)



# -------- Wi-Fi ----------
from adresses import * # self-written file containing necessary credentials as strings
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect(ssid(), password())

counter = 0
while not wlan.isconnected():
    Display.fill(0) # empty the frame buffer
    stat = "Connecting" + "."*counter
    Display.text(stat,0,0, 1)
    Display.show()
    counter += 1
    if counter>3:
        counter = 0
    time.sleep(1)

print("IP:", wlan.ifconfig()[0])
led.value(1)
Display.fill(0) # empty the frame buffer
Display.text("Connected",30,25, 1)
Display.show()
time.sleep(1)



def main(display):
    prior_height = 0
    prior_lightval = light.read_u16()
    np.write()
    while True:
        try:
            response = urequests.get(url()) # <-- reads (table) data from the desk manager
            json_data = response.json()
            response.close()
            
            name = json_data['config']['name']
            height = json_data['state']['position_mm']
            
            display.fill(0)
            display.text(f"{name}", 0, 0, 1)
            display.text(f"Height: {height}", 0, 15, 1)
            display.hline(0,int(HEIGHT/2),WIDTH,1)
            display.text(f"Room Temp: {round(read_temp(), 2)}", 0, 40, 1)
            display.text(f"Light val: {light.read_u16()}", 0, 55, 1)
            display.show()
            
            if int(height)<prior_height:
                np[0] = (255, 0, 0)  # Red
            if int(height)>prior_height:
                np[0] = (0, 255, 0)  # Green
            if int(height)==prior_height:
                np[0] = (0, 0, 55)  # Blue
            prior_height = int(height)
            np.write()
            
            if (light.read_u16()-prior_lightval)>500 or light.read_u16()>40000:
                lamp.value(1)
                buzzer.duty_u16(30000)
            else:
                lamp.value(0)
                buzzer.duty_u16(0)

            prior_lightval = light.read_u16()
            
            del response
            del json_data
            gc.collect()
            
        except Exception as e:
            print(e)
            display.fill(0)
            display.text("error:", 0, 0, 1)
            display.text(str(e), 0, 20, 1)
            display.text("pls reset device", 0, 50, 1)
            display.show()



main(Display)





