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

async def generate_video(prompt):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    profile_path = os.path.join(script_dir, "google_profile")
    project_root = os.path.dirname(script_dir)
    downloads_dir = os.path.join(project_root, "downloads", "veo")
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
    print(f"\n🚀 Booting up Veo Automation...")
    print(f"🎯 Target Prompt: '{prompt}'\n")
    print(f"📁 Videos will be saved to: {downloads_dir}\n")
    
    browser = await uc.start(
        headless=False, 
        user_data_dir=profile_path
    )

    # =========================================================
    # 🌟 DASHBOARD NAVIGATION ("NEW PROJECT" CLICKER)
    # =========================================================
    print("🌐 Opening Veo Dashboard...")
    base_url = "https://labs.google/fx/tools/flow"
    page = await browser.get(base_url)

    print("⏳ Checking dashboard status...")
    await asyncio.sleep(8) # Wait slightly longer for Google's UI to load

    try:
        current_url = await page.evaluate("window.location.href")
        
        if "/project/" not in current_url:
            print("   👉 We are on the dashboard. Hunting for the 'Create' button...")
            
            # 🌟 STRATEGY 1: Aggressive AI UI Clicker
            clicked = await page.evaluate("""
                (() => {
                    const elements = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
                    for (let el of elements) {
                        let text = (el.innerText || '').toLowerCase().replace(/\\s+/g, ' ');
                        let ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                        
                        // Expanded keywords to catch any Google UI updates
                        if (
                            text === 'create' || 
                            text === 'new' || 
                            text.includes('new project') || 
                            text.includes('create video') || 
                            text.includes('blank project') ||
                            ariaLabel.includes('new project') ||
                            ariaLabel.includes('create')
                        ) {
                            let rect = el.getBoundingClientRect();
                            if (rect.width > 0 && rect.height > 0) {
                                const opts = { bubbles: true, cancelable: true, view: window, buttons: 1, clientX: rect.left + rect.width/2, clientY: rect.top + rect.height/2 };
                                el.dispatchEvent(new PointerEvent('pointerdown', opts));
                                el.dispatchEvent(new MouseEvent('mousedown', opts));
                                el.dispatchEvent(new PointerEvent('pointerup', opts));
                                el.dispatchEvent(new MouseEvent('mouseup', opts));
                                el.click();
                                return true;
                            }
                        }
                    }
                    return false;
                })();
            """)
            
            if clicked:
                 print("   ✅ Found and clicked the Creation button! Waiting for workspace...")
                 await asyncio.sleep(10)
            else:
                 print("   ❌ CRITICAL: Could not find the 'Create' button on the dashboard.")
                 print("   ⚠️ Google might have changed their UI. Stopping to prevent dead-end errors.")
                 browser.stop()
                 return
        else:
            print("   ✅ Google auto-redirected us to an active project workspace.")
            
    except Exception as e:
        print(f"   ❌ Error navigating dashboard: {e}")

    # =========================================================
    # 🌟 PROMPT TYPING & GENERATION
    # =========================================================
    print("⏳ Waiting for the AI Editor to fully load...")
    editor_div = None
    
    # We must ensure we are on a project page before looking for text boxes
    current_url = await page.evaluate("window.location.href")
    if "/project" not in current_url and "/flow" not in current_url:
         print("❌ CRITICAL: Not on a project page. Navigation failed.")
         browser.stop()
         return

    for i in range(30): 
        try:
            editor_div = await page.select('[role="textbox"]')
            if not editor_div:
                editor_div = await page.select('textarea')
            if not editor_div:
                editor_div = await page.select('[contenteditable="true"]')
                
            if editor_div:
                print("✅ Found the input box!")
                break
        except:
            pass
        await asyncio.sleep(1)

    if not editor_div:
        print("❌ CRITICAL: Text box never appeared.")
        browser.stop()
        return

    print("✍️ Typing the prompt like a real human...")
    try:
        await editor_div.click()
        await asyncio.sleep(1)
        for char in prompt:
            await editor_div.send_keys(char)
            await asyncio.sleep(0.05)
        await editor_div.send_keys(" ") 
    except Exception as e:
        print(f"❌ Failed to type: {e}")

    await asyncio.sleep(3) 

    print("📸 Taking snapshot of old videos...")
    existing_srcs = await page.evaluate("""
        (() => {
            return Array.from(document.querySelectorAll('video')).map(v => v.src).filter(src => src !== '');
        })();
    """)
    print(f"   -> Found {len(existing_srcs)} old videos to ignore.")

    print("✨ Submitting the prompt...")
    try:
        await editor_div.send_keys('\n')
        print("✅ Pressed 'Enter' to start generation!")
        await asyncio.sleep(1)
        
        # Click the generate/create button just in case Enter didn't work
        clicked_gen = await page.evaluate("""
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
                    for (let btn of buttons) {
                        let text = (btn.innerText || '').toLowerCase();
                        let ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                        if (text.includes('generate') || text.includes('create') || ariaLabel.includes('generate')) {
                            btn.click();
                            return true;
                        }
                    }
                    return false;
                })();
            """)
        if clicked_gen:
             print("   ✅ Clicked the 'Generate' button as fallback.")
            
    except Exception as e:
        print(f"❌ Error submitting prompt: {e}")

    print("⏳ Waiting for Veo to render the NEW video... (Will wait up to 10 minutes)")
    
    await asyncio.sleep(20)
    new_video_srcs = []
    
    for i in range(120): 
        if i % 12 == 0 and i > 0:
            print(f"   ... still waiting ({i * 5} seconds elapsed)")
            
        try:
            current_srcs = await page.evaluate("""
                (() => {
                    return Array.from(document.querySelectorAll('video')).map(v => v.src).filter(src => src !== '');
                })();
            """)
            
            for src in current_srcs:
                if src not in existing_srcs and src not in new_video_srcs:
                    new_video_srcs.append(src)
            
            if len(new_video_srcs) > 0:
                print(f"\n🎉 SUCCESS! DETECTED {len(new_video_srcs)} NEW VIDEO(S)!")
                break
                
        except Exception as e:
            pass 
        await asyncio.sleep(5) 
    
    if not new_video_srcs:
        print("\n❌ Timed out waiting for the video.")
        browser.stop()
        return

    # =========================================================
    # 🌟 SECURE BLOB DOWNLOADER
    # =========================================================
    print("\n📥 Automating Secure Download...")
    existing_local_files = set(os.listdir(downloads_dir))

    print("   👉 Selecting the newest video to open the High-Res Player...")
    try:
        await page.evaluate("""
            (() => {
                const videos = document.querySelectorAll('video');
                if(videos.length > 0) {
                    videos[0].click(); 
                    if (videos[0].parentElement) {
                        videos[0].parentElement.click(); 
                    }
                }
            })();
        """)
        await asyncio.sleep(4) 
    except Exception as e:
        print(f"   ⚠️ Could not click video: {e}")

    print("   👉 Fetching secure high-res video using browser cookies...")
    try:
        success = await page.evaluate("""
            new Promise(async (resolve) => {
                try {
                    const videos = document.querySelectorAll('video');
                    if(videos.length === 0) { resolve(false); return; }
                    
                    let activeVideo = videos[0];
                    let maxArea = 0;
                    for (let v of videos) {
                        let rect = v.getBoundingClientRect();
                        let area = rect.width * rect.height;
                        if (area > maxArea) {
                            maxArea = area;
                            activeVideo = v;
                        }
                    }

                    if(!activeVideo.src) { resolve(false); return; }

                    const response = await fetch(activeVideo.src);
                    if (!response.ok) { resolve(false); return; }
                    
                    const blob = await response.blob();
                    const blobUrl = window.URL.createObjectURL(blob);
                    
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = "veo_video.mp4";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    
                    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
                    resolve(true);
                } catch (e) {
                    resolve(false);
                }
            });
        """)

        if success:
            print("   ✅ Successfully triggered secure authenticated download!")
        else:
            print("   ⚠️ Could not fetch the video blob.")
    except Exception as e:
        print(f"   ❌ Failed to execute blob extraction: {e}")

    print(f"      [System] Waiting for Chrome to finish saving the file...")
    
    success = False
    for _ in range(90): 
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
                new_name = f"veo_{safe_prompt}_{int(time.time())}_v{idx+1}.mp4"
                new_path = os.path.join(downloads_dir, new_name)
                try:
                    os.rename(old_path, new_path)
                    print(f"   🔄 Renamed to: {new_name}")
                except:
                    pass
            success = True
            break
                
    if not success:
         print(f"   ❌ Download timed out. Check your downloads folder manually!")

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
        parser.add_argument('--prompt', type=str, help="The video prompt to send to Veo")
        args = parser.parse_args()
        prompt = args.prompt
    
    if prompt:
        try:
            asyncio.run(generate_video(prompt))
        except Exception as e:
            print(f"\n❌ FATAL CRASH: {e}")
        finally:
            sys.stderr = open(os.devnull, 'w')
            # --- 🌟 FRONTEND FIX 2: THE QUIET EXIT 🌟 ---
            os._exit(0)
    else:
        print("\n❌ ERROR: No prompt provided. Set AI_PROMPT env variable or use --prompt.")
        sys.exit(1)