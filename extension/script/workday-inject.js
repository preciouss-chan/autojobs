// Workday page-context injection script
// Runs in the actual page context to access React internals
// This bypasses content script CSP restrictions

(function() {
  console.log("⏰ Workday inject script loaded");

  // Prevent loading this script multiple times
  if (window.AUTOJOBS_WORKDAY_SCRIPT_LOADED) {
    console.log("⏰ Workday inject script already loaded, skipping");
    return;
  }
  window.AUTOJOBS_WORKDAY_SCRIPT_LOADED = true;

  // Detect Firefox (using userAgent since InstallTrigger is deprecated)
  const isFirefox = navigator.userAgent.includes('Firefox');
  
  // Track if this script has already processed an upload to prevent double-uploads
  window.AUTOJOBS_WORKDAY_UPLOAD_IN_PROGRESS = false;

  window.addEventListener('AUTOJOBS_WORKDAY_UPLOAD', async (event) => {
    // Prevent duplicate uploads
    if (window.AUTOJOBS_WORKDAY_UPLOAD_IN_PROGRESS) {
      console.log("⏰ Upload already in progress, ignoring duplicate request");
      return;
    }
    
    window.AUTOJOBS_WORKDAY_UPLOAD_IN_PROGRESS = true;
    
    const { fileData, fileName, fileType, mimeType } = event.detail;
    console.log("⏰ Workday upload event received:", fileName, fileType);

    try {
      // Convert base64 to File
      const binary = atob(fileData);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const file = new File([bytes], fileName, { type: mimeType || 'application/pdf' });

      // Find the file input
      const targetInput = document.querySelector('[data-automation-id="file-upload-input-ref"]');
      
      if (!targetInput) {
        console.error("⏰ No file input found for Workday");
        window.dispatchEvent(new CustomEvent('AUTOJOBS_WORKDAY_RESULT', { detail: { success: false } }));
        window.AUTOJOBS_WORKDAY_UPLOAD_IN_PROGRESS = false;
        return;
      }

      console.log("⏰ Found target input:", targetInput);

      // Set files using DataTransfer
      const dt = new DataTransfer();
      dt.items.add(file);
      
      // Override the files property - Firefox requires special handling
      if (isFirefox) {
        try {
          const nativeInputFileSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
          if (nativeInputFileSetter) {
            nativeInputFileSetter.call(targetInput, dt.files);
          } else {
            targetInput.files = dt.files;
          }
        } catch (e) {
          targetInput.files = dt.files;
        }
      } else {
        Object.defineProperty(targetInput, 'files', {
          value: dt.files,
          writable: false,
          configurable: true
        });
      }

      console.log("⏰ Files set, checking for React fiber...");

      // Method 1: Try to find React fiber and call onChange
      let reactHandlerCalled = false;
      const reactKeys = Object.keys(targetInput).filter(key => 
        key.startsWith('__reactFiber$') || 
        key.startsWith('__reactInternalInstance$') ||
        key.startsWith('__reactProps$')
      );

      console.log("⏰ Found React keys:", reactKeys);

      for (const reactKey of reactKeys) {
        try {
          let fiber = targetInput[reactKey];
          let depth = 0;
          
          console.log("⏰ Walking fiber tree from:", reactKey);
          
          for (let i = 0; i < 30 && fiber; i++) {
            depth = i;
            const props = fiber.memoizedProps || fiber.pendingProps || fiber.stateNode?.props;
            
            if (props?.onChange) {
              console.log(`⏰ Found onChange handler at fiber depth ${i}`);
              
              const syntheticEvent = {
                target: targetInput,
                currentTarget: targetInput,
                type: 'change',
                bubbles: true,
                cancelable: true,
                preventDefault: () => {},
                stopPropagation: () => {},
                nativeEvent: new Event('change', { bubbles: true })
              };
              
              props.onChange(syntheticEvent);
              console.log(`⏰ Called onChange handler`);
              reactHandlerCalled = true;
              break;
            }
            
            fiber = fiber.return;
          }
          
          if (reactHandlerCalled) break;
        } catch (e) {
          console.error(`⏰ Error walking fiber tree:`, e.message);
        }
      }

      if (!reactHandlerCalled) {
        console.log(`⏰ No React onChange handler found, triggering DOM events instead`);
      }

      // Method 2: Dispatch standard events
      console.log("⏰ Dispatching DOM events...");
      targetInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      targetInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      targetInput.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));

       // Method 3: Try to find parent container and trigger events
       const container = targetInput.closest('[data-automation-id="resumeUpload"]');
       if (container) {
         console.log("⏰ Found parent container, triggering events...");
         container.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
         container.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
       }

       // NOTE: Removed drop zone event triggers (Method 4) because they were causing
       // Workday to treat it as a separate upload attempt, resulting in 2 uploads instead of 1
       // The input element's change/input/blur events should be sufficient

      // Wait a bit for React to process
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Try to find and call React onChange handler to ensure file is retained
      console.log("⏰ Attempting to trigger React handlers...");
      
      let handlerCalled = false;
      const reactKeys2 = Object.keys(targetInput).filter(key => 
        key.startsWith('__reactFiber$') || 
        key.startsWith('__reactInternalInstance$') ||
        key.startsWith('__reactProps$')
      );
      
      for (const reactKey of reactKeys2) {
        try {
          let fiber = targetInput[reactKey];
          for (let i = 0; i < 30 && fiber; i++) {
            const props = fiber.memoizedProps || fiber.pendingProps || fiber.stateNode?.props;
            
            if (props?.onChange) {
              console.log(`⏰ Calling React onChange at depth ${i}`);
              const syntheticEvent = {
                target: targetInput,
                currentTarget: targetInput,
                type: 'change',
                bubbles: true,
                cancelable: true,
                preventDefault: () => {},
                stopPropagation: () => {},
                nativeEvent: new Event('change', { bubbles: true })
              };
              props.onChange(syntheticEvent);
              handlerCalled = true;
              break;
            }
            fiber = fiber.return;
          }
          if (handlerCalled) break;
        } catch (e) {
          console.error(`⏰ Error with fiber ${reactKey}:`, e.message);
        }
      }
       
       if (!handlerCalled) {
         console.log("⏰ No React onChange found - events already dispatched on input element");
         // Events were already dispatched in Method 2, no need to repeat
       }
      
       // Final check with delay to let React update
       await new Promise(resolve => setTimeout(resolve, 200));

       // Report success if React onChange was called
       // (The file might be cleared from DOM but React has it internally)
       if (reactHandlerCalled) {
         console.log("✅ Workday file upload successful - React handler was called");
         window.dispatchEvent(new CustomEvent('AUTOJOBS_WORKDAY_RESULT', { detail: { success: true } }));
       } else if (targetInput.files && targetInput.files.length > 0) {
         console.log("✅ Workday file upload successful - file retained in input");
         window.dispatchEvent(new CustomEvent('AUTOJOBS_WORKDAY_RESULT', { detail: { success: true } }));
       } else {
         console.error("❌ File not retained and React handler not called");
         window.dispatchEvent(new CustomEvent('AUTOJOBS_WORKDAY_RESULT', { detail: { success: false } }));
       }

    } catch (err) {
      console.error("❌ Workday upload error:", err);
      window.dispatchEvent(new CustomEvent('AUTOJOBS_WORKDAY_RESULT', { detail: { success: false, error: err.message } }));
    } finally {
      // Reset flag to allow next upload
      setTimeout(() => {
        window.AUTOJOBS_WORKDAY_UPLOAD_IN_PROGRESS = false;
      }, 500);
    }
  });

  console.log("⏰ Workday inject script ready");
})();
