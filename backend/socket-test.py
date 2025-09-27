# using websocat or a small python script is better than curl for websockets, but your sample is fine for docs
# Using the earlier python test harness (adapted):

import asyncio, websockets, json
FT_WS = "wss://piconnect.flattrade.in/PiConnectWSTp/"
async def run():
    async with websockets.connect(FT_WS) as ws:
        # send initial connect (replace with your user/token)
        await ws.send(json.dumps({"t":"c","uid":"FZ00000","actid":"FZ00000","source":"API","susertoken":"YOUR_TOKEN"}))
        print("ACK:", await ws.recv())
        # Now send touchline subscription exactly like your curl example:
        await ws.send(json.dumps({"t":"t","k":"NSE|22#BSE|508123#NSE|10#BSE|2879"}))
        for _ in range(5):
            print("MSG:", await ws.recv())
asyncio.run(run())

