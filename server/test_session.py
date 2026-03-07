import nodriver as uc
import asyncio
import os

async def main():
    profile_path = os.path.join(os.getcwd(), "google_profile")
    
    print("🚀 Booting up the bot using your saved human session...")
    
    browser = await uc.start(
        headless=False,
        user_data_dir=profile_path
    )

    # Go directly to Google Veo (VideoFX)
    print("🌐 Navigating to Google VideoFX...")
    page = await browser.get('https://aitestkitchen.withgoogle.com/tools/video-fx')

    print("\n=======================================================")
    print("🛑 THE BROWSER IS OPEN FOR 2 MINUTES")
    print("👉 If you see a 'Welcome' or 'Agree to Terms' popup, CLICK IT NOW.")
    print("👉 You just need to reach the blank text box where you type prompts.")
    print("=======================================================\n")

    # Wait for 120 seconds (2 minutes)
    for i in range(120, 0, -10):
        print(f"⏳ Closing in {i} seconds...")
        await asyncio.sleep(10)

    print("\n✅ Time is up! Session saved.")
    browser.stop()

if __name__ == '__main__':
    asyncio.run(main())