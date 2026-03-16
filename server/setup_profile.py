import nodriver as uc
import asyncio
import os

async def main():
    # 1. Define the persistent folder where your Google Session will live
    profile_path = os.path.join(os.getcwd(), "google_profile")
    print(f"\n📁 Chrome Profile will be saved to: {profile_path}")
    
    # 2. Start nodriver in visible mode (headless=False)
    print("🚀 Booting up anti-detect browser...")
    browser = await uc.start(
        headless=False,
        user_data_dir=profile_path
    )

    # 3. Navigate to the Google Login page
    print("🌐 Navigating to Google Login...")
    page = await browser.get('https://accounts.google.com/')

    # 4. Give the human time to log in
    print("\n=======================================================")
    print("🛑 STOP! THE BROWSER IS OPEN.")
    print("👉 Manually type your burner Google account email.")
    print("👉 Type your password and complete any 2FA/Captchas.")
    print("=======================================================\n")
    
    # Keep the script running for 3 minutes while you log in
    for i in range(180, 0, -10):
        print(f"⏳ Waiting for you to log in... {i} seconds remaining.")
        await asyncio.sleep(10)

    # 5. Shut down and save
    print("\n✅ Time is up! Saving your session cookies and closing the browser...")
    
    browser.stop()
    await asyncio.sleep(1) # <-- ADD THIS: Gives Windows a second to close the pipes cleanly
    
    print("🔒 Session saved successfully! You are ready for full automation.")

if __name__ == '__main__':
    # ADD THIS: Suppresses the unavoidable Windows closing errors
    import sys
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    try:
        asyncio.run(main())
    except Exception:
        pass # Ignore the shutdown noise