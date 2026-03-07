import nodriver as uc
import asyncio
import os
import argparse

async def generate_video(prompt):
    profile_path = os.path.join(os.getcwd(), "google_profile")
    print(f"\n🚀 Booting up Veo Automation...")
    print(f"🎯 Target Prompt: '{prompt}'\n")
    
    browser = await uc.start(
        headless=False, 
        user_data_dir=profile_path
    )

    print("🌐 Opening Veo project...")
    project_url = "https://labs.google/fx/tools/flow/project/4ab36e3b-4952-415f-86e8-6bd41863032f"
    page = await browser.get(project_url)

    # 1. Wait for the text box
    print("⏳ Waiting for the AI Editor to fully load...")
    prompt_box = None
    for i in range(30): 
        try:
            prompt_box = await page.find('What do you want to create', best_match=True)
            if prompt_box:
                break
        except:
            pass
        await asyncio.sleep(1)

    if not prompt_box:
        print("❌ CRITICAL: Text box never appeared.")
        browser.stop()
        return

    # 2. Type like a human
    print("✍️ Typing the prompt like a real human...")
    await prompt_box.click()
    await asyncio.sleep(1)
    
    try:
        editor_div = await page.select('[role="textbox"]')
        await editor_div.click()
        await asyncio.sleep(0.5)
        
        for char in prompt:
            await editor_div.send_keys(char)
            await asyncio.sleep(0.05)
            
        await editor_div.send_keys(" ") # Trigger React word boundary
    except Exception as e:
        print(f"❌ Failed to type: {e}")

    # 3. Let React validate the text
    await asyncio.sleep(3) 

    # 4. Click Create
    print("✨ Clicking the Create button...")
    try:
        buttons = await page.select_all('button')
        for btn in buttons:
            if btn.text_all and ("Create" in btn.text_all or "Generate" in btn.text_all):
                await btn.click()
                print("✅ Clicked the Create button!")
                break
    except Exception as e:
        print(f"❌ Error clicking Create: {e}")

    # 5. Wait for the video to render
    print("⏳ Waiting for Veo to render the video... (This usually takes 1 to 2 minutes)")
    video_generated = False
    
    for i in range(60): 
        await asyncio.sleep(5) 
        try:
            # Look for the video player to appear on screen
            video_element = await page.select('video')
            if video_element:
                print("\n🎉 SUCCESS! VIDEO GENERATED!")
                video_generated = True
                break
        except:
            pass 
    
    if not video_generated:
        print("\n❌ Timed out waiting for the video.")
        browser.stop()
        return

    print("\n=================================================")
    print("🛑 VIDEO IS READY.")
    print("=================================================\n")
    
    await asyncio.sleep(300) 
    browser.stop()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--prompt', type=str, required=True, help="The video prompt to send to Veo")
    args = parser.parse_args()
    
    asyncio.run(generate_video(args.prompt))