import nodriver as uc
import asyncio
import os
import argparse
import sys
import time
import json
import warnings

# Ignore standard Windows background warnings
warnings.filterwarnings("ignore", category=ResourceWarning)

async def generate_sora(prompt):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    profile_path = os.path.join(script_dir, "sora_profile")
    project_root = os.path.dirname(script_dir)
    downloads_dir = os.path.join(project_root, "downloads", "sora")
    os.makedirs(downloads_dir, exist_ok=True)

    # =========================================================
    # 🌟 FORCE CHROME TO AUTO-DOWNLOAD TO FOLDER
    # =========================================================
    default_profile_dir = os.path.join(profile_path, "Default")
    os.makedirs(default_profile_dir, exist_ok=True)
    prefs_file = os.path.join(default_profile_dir, "Preferences")
    
    prefs_data = {}
    if os.path.exists(prefs_file):
        try:
            with open(prefs_file, 'r', encoding='utf-8') as f:
                prefs_data = json.load(f)
        except Exception:
            pass

    if 'download' not in prefs_data:
        prefs_data['download'] = {}
    if 'profile' not in prefs_data:
        prefs_data['profile'] = {}
    if 'default_content_setting_values' not in prefs_data['profile']:
        prefs_data['profile']['default_content_setting_values'] = {}
        
    prefs_data['download']['prompt_for_download'] = False
    prefs_data['download']['default_directory'] = downloads_dir
    prefs_data['profile']['default_content_setting_values']['automatic_downloads'] = 1 

    try:
        with open(prefs_file, 'w', encoding='utf-8') as f:
            json.dump(prefs_data, f)
    except Exception:
        pass

    # =========================================================
    # START AUTOMATION
    # =========================================================
    print(f"\n🚀 Booting up Sora Automation...")
    print(f"🎯 Target Prompt: '{prompt}'\n")
    print(f"📁 Videos will be saved to: {downloads_dir}\n")

    browser = await uc.start(headless=False, user_data_dir=profile_path)
    
    # =========================================================
    # 🌟 STEP 1: SNAPSHOT OLD VIDEOS (PRIVATE LIBRARY)
    # =========================================================
    print("📸 Navigating to your Library to snapshot existing videos...")
    page = await browser.get("https://sora.chatgpt.com/library")
    await asyncio.sleep(8) 
    
    raw_existing = await page.evaluate("""
        (() => {
            return Array.from(document.querySelectorAll('a[href*="/g/"]')).map(a => a.href);
        })();
    """)
    
    existing_links = []
    if raw_existing:
        existing_links = [item['value'] if isinstance(item, dict) and 'value' in item else item for item in raw_existing]
        
    print(f"   -> Found {len(existing_links)} old videos. We will ignore these.")

    # =========================================================
    # 🌟 STEP 2: OPEN HOME & FORCE VIDEO MODE
    # =========================================================
    print("\n🌐 Opening Sora Home...")
    await page.get("https://sora.chatgpt.com/")
    await asyncio.sleep(6)

    print("👉 Checking generation mode (Image vs Video)...")
    try:
        is_image_mode = await page.evaluate("""
            (() => {
                const buttons = Array.from(document.querySelectorAll('button[role="combobox"]'));
                for (let btn of buttons) {
                    if ((btn.innerText || '').includes('Image')) {
                        let rect = btn.getBoundingClientRect();
                        const opts = { bubbles: true, cancelable: true, view: window, buttons: 1, clientX: rect.left + rect.width/2, clientY: rect.top + rect.height/2 };
                        btn.dispatchEvent(new PointerEvent('pointerdown', opts));
                        btn.dispatchEvent(new MouseEvent('mousedown', opts));
                        btn.dispatchEvent(new PointerEvent('pointerup', opts));
                        btn.dispatchEvent(new MouseEvent('mouseup', opts));
                        btn.click();
                        return true;
                    }
                }
                return false;
            })();
        """)

        if is_image_mode:
            print("   👉 Dropdown opened! Waiting for menu to render...")
            await asyncio.sleep(1.5) 
            
            try:
                vid_opt = await page.find("Video")
                if vid_opt:
                    await vid_opt.click()
                    print("   ✅ Hardware-Clicked 'Video' perfectly!")
            except Exception:
                await page.evaluate("""
                    (() => {
                        const items = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"]'));
                        for (let item of items) {
                            if ((item.innerText || '').includes('Video')) {
                                let rect = item.getBoundingClientRect();
                                const opts = { bubbles: true, cancelable: true, view: window, buttons: 1, clientX: rect.left + rect.width/2, clientY: rect.top + rect.height/2 };
                                item.dispatchEvent(new PointerEvent('pointerdown', opts));
                                item.dispatchEvent(new MouseEvent('mousedown', opts));
                                item.dispatchEvent(new PointerEvent('pointerup', opts));
                                item.dispatchEvent(new MouseEvent('mouseup', opts));
                                item.click();
                            }
                        }
                    })();
                """)
                print("   ✅ JS-Clicked 'Video'!")
            await asyncio.sleep(1)
            
    except Exception as e:
        print(f"   ⚠️ Mode switch error: {e}")

    # =========================================================
    # 🌟 STEP 3: TYPE PROMPT & SUBMIT
    # =========================================================
    print("✍️ Finding the input box...")
    textarea = None
    for i in range(15):
        try:
            textarea = await page.select('textarea')
            if textarea:
                break
        except:
            pass
        await asyncio.sleep(1)

    if not textarea:
        print("❌ CRITICAL: Could not find Sora's text box.")
        browser.stop()
        return

    print("✍️ Typing prompt...")
    try:
        await textarea.click()
        await asyncio.sleep(1)
        for char in prompt:
            await textarea.send_keys(char)
            await asyncio.sleep(0.02)
        await asyncio.sleep(1)
        
        print("✨ Clicking the Generate button...")
        clicked = await page.evaluate("""
            (() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                for (let btn of buttons) {
                    let sr = btn.querySelector('.sr-only');
                    let srText = sr ? (sr.innerText || sr.textContent).toLowerCase() : '';
                    if (srText.includes('create') || srText.includes('send') || srText.includes('generate')) {
                        let rect = btn.getBoundingClientRect();
                        const opts = { bubbles: true, cancelable: true, view: window, buttons: 1, clientX: rect.left + rect.width/2, clientY: rect.top + rect.height/2 };
                        btn.dispatchEvent(new PointerEvent('pointerdown', opts));
                        btn.dispatchEvent(new MouseEvent('mousedown', opts));
                        btn.dispatchEvent(new PointerEvent('pointerup', opts));
                        btn.dispatchEvent(new MouseEvent('mouseup', opts));
                        btn.click();
                        return true;
                    }
                }
                return false;
            })();
        """)
        
        if clicked:
            print("   ✅ Clicked the Generate button successfully!")
        else:
            print("   ⚠️ Could not find the generate button, falling back to Enter key...")
            await textarea.send_keys('\n')
            
    except Exception as e:
        print(f"❌ Failed to submit prompt: {e}")

    # =========================================================
    # 🌟 STEP 4: NAVIGATE TO LIBRARY AND FIND NEW JOB
    # =========================================================
    print("\n🌐 Returning to your Library to track your new generation...")
    await asyncio.sleep(4) 
    await page.get("https://sora.chatgpt.com/library")
    
    new_video_url = None
    print("⏳ Waiting for the new video card to appear in your library...")
    for i in range(30): 
        await asyncio.sleep(5)
        
        raw_current = await page.evaluate("""
            (() => {
                return Array.from(document.querySelectorAll('a[href*="/g/"]')).map(a => a.href);
            })();
        """)
        
        current_links = []
        if raw_current:
            current_links = [item['value'] if isinstance(item, dict) and 'value' in item else item for item in raw_current]
        
        if current_links:
            for link in current_links:
                if link not in existing_links:
                    new_video_url = link
                    break
        
        if new_video_url:
            print(f"   ✅ Found new generation job: {new_video_url}")
            break
        else:
            if i % 3 == 0 and i > 0:
                print("   ... refreshing library to check for new job...")
                await page.reload()
                await asyncio.sleep(4)
                
    if not new_video_url:
        print("❌ CRITICAL: The new video never appeared. Did the prompt submit correctly?")
        browser.stop()
        return

    # =========================================================
    # 🌟 STEP 5: SMART WAIT FOR FULL GENERATION (UP TO 10 MIN)
    # =========================================================
    print(f"\n🎬 Opening dedicated video player...")
    
    existing_local_files = set(os.listdir(downloads_dir))
    
    await page.get(new_video_url)
    await asyncio.sleep(5)

    print("\n=======================================================")
    print("🧠 INITIATING SMART WAIT FOR SORA RENDERING")
    print("⏳ Will check every 5s for up to 10 minutes...")
    print("=======================================================")

    success = False
    
    # 120 iterations * 5 seconds = 600 seconds = 10 minutes maximum wait
    for i in range(120): 
        if i % 6 == 0 and i > 0:
            print(f"   ... still checking ({i * 5} seconds elapsed)")
            
        try:
            fetched = await page.evaluate("""
                (() => {
                    if (window.botDownloadTriggered) return true;

                    // 1. SMART CHECK: Does the page still say "Generating..." or "Queued"?
                    const pageText = document.body.innerText.toLowerCase();
                    if (pageText.includes('generating') || pageText.includes('queued') || pageText.includes('creating')) {
                        return false; // Still generating, skip this check
                    }

                    const videos = Array.from(document.querySelectorAll('video'));
                    if(videos.length === 0) return false;
                    
                    let validVideos = videos.filter(v => {
                        let rect = v.getBoundingClientRect();
                        return rect.width > 200 && rect.height > 200;
                    });
                    
                    if (validVideos.length === 0) return false;

                    // Spatial sorting to find the Top-Left video
                    validVideos.sort((a, b) => {
                        let rectA = a.getBoundingClientRect();
                        let rectB = b.getBoundingClientRect();
                        if (Math.abs(rectA.top - rectB.top) > 50) return rectA.top - rectB.top;
                        return rectA.left - rectB.left;
                    });
                    
                    let activeVideo = validVideos[0];
                    
                    // 2. SMART CHECK: Make sure it's not a placeholder video!
                    if (!activeVideo.duration || activeVideo.duration < 3) {
                        return false; 
                    }

                    // 3. SMART CHECK: Make sure the video is fully loaded
                    if (activeVideo.readyState < 3) return false;

                    const videoSrc = activeVideo.src || (activeVideo.querySelector('source') ? activeVideo.querySelector('source').src : null);
                    if (!videoSrc || videoSrc.trim() === '') return false;

                    // THE VIDEO IS READY! Trigger the download!
                    window.botDownloadTriggered = true;

                    fetch(videoSrc)
                        .then(response => response.blob())
                        .then(blob => {
                            const blobUrl = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = blobUrl;
                            a.download = "sora_video.mp4";
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                        })
                        .catch(e => {
                            window.botDownloadTriggered = false; // Allow retry if network fails
                        });

                    return true; 
                })();
            """)
            
            if fetched:
                success = True
                print(f"\n   ✅ Generation complete at {i * 5} seconds! Download triggered!")
                break
        except Exception:
            pass
            
        await asyncio.sleep(5) 

    # =========================================================
    # 🌟 STEP 6: WAIT FOR CHROME TO FINISH SAVING
    # =========================================================
    if success:
        print(f"      [System] Waiting for Chrome to finish saving the file to {downloads_dir}...")
        download_success = False
        
        for _ in range(180): 
            await asyncio.sleep(1)
            current_local_files = set(os.listdir(downloads_dir))
            
            is_downloading = any(f.endswith(".crdownload") for f in current_local_files)
            new_files = current_local_files - existing_local_files
            new_mp4s = [f for f in new_files if f.endswith(".mp4")]
            
            if not is_downloading and len(new_mp4s) > 0:
                print(f"   ✅ REAL Video safely saved: {new_mp4s}")
                
                for idx, mp4 in enumerate(new_mp4s):
                    old_path = os.path.join(downloads_dir, mp4)
                    safe_prompt = "".join([c if c.isalnum() else "_" for c in prompt])[:30]
                    new_name = f"sora_{safe_prompt}_{int(time.time())}.mp4"
                    new_path = os.path.join(downloads_dir, new_name)
                    try:
                        os.rename(old_path, new_path)
                        print(f"   🔄 Renamed to: {new_name}")
                    except:
                        pass
                download_success = True
                break
                    
        if not download_success:
             print(f"   ❌ Download timed out. Check your downloads folder manually!")
    else:
        print("\n❌ Timed out waiting for generation to finish after 10 minutes. Did Sora get stuck?")

    print("\n=================================================")
    print("🛑 ALL DONE. SCRIPT COMPLETE.")
    print("=================================================\n")
    
    browser.stop()
    await asyncio.sleep(1)

if __name__ == '__main__':
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    # --- 🌟 FRONTEND FIX 1: THE ENVIRONMENT VARIABLE BRIDGE 🌟 ---
    prompt = os.environ.get("AI_PROMPT")

    if not prompt:
        parser = argparse.ArgumentParser()
        parser.add_argument('--prompt', type=str, help="The video prompt to send to Sora")
        args = parser.parse_args()
        prompt = args.prompt
    
    if prompt:
        try:
            asyncio.run(generate_sora(prompt))
        except Exception as e:
            print(f"\n❌ FATAL CRASH: {e}")
        finally:
            sys.stderr = open(os.devnull, 'w')
            # --- 🌟 FRONTEND FIX 2: THE QUIET EXIT 🌟 ---
            os._exit(0)
    else:
        print("\n❌ ERROR: No prompt provided. Set AI_PROMPT env variable or use --prompt.")
        sys.exit(1)