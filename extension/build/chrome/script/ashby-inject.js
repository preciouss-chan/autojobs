// Ashby page-context injection script
// Runs in the actual page context to access React internals

(function() {
  console.log("🎨 Ashby inject script loaded");

  // Detect Firefox (using userAgent since InstallTrigger is deprecated)
  const isFirefox = navigator.userAgent.includes('Firefox');

  window.addEventListener('AUTOJOBS_ASHBY_UPLOAD', async (event) => {
    const { fileData, fileName, fileType, mimeType } = event.detail;
    console.log("🎨 Ashby upload event received:", fileName, fileType);

    try {
      // Convert base64 to File
      const binary = atob(fileData);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const file = new File([bytes], fileName, { type: mimeType || 'application/pdf' });

      // Find the file input in Ashby's uploader
      const uploaders = document.querySelectorAll('.ashby-application-form-autofill-uploader, [class*="autofill-uploader"]');
      console.log("🎨 Found uploaders:", uploaders.length);

      let targetInput = null;
      let targetUploader = null;

      for (const uploader of uploaders) {
        const input = uploader.querySelector('input[type="file"]');
        if (!input) continue;

        const container = uploader.closest('[class*="_autofillPane"]') || uploader.parentElement;
        const text = container?.textContent?.toLowerCase() || '';
        
        const isResumeUploader = text.includes('resume') || text.includes('cv') || text.includes('résumé');
        const isCoverUploader = text.includes('cover letter') || text.includes('coverletter');

        if (fileType === "cover" && isCoverUploader) {
          targetInput = input;
          targetUploader = uploader;
          break;
        } else if (fileType !== "cover" && (isResumeUploader || (!isCoverUploader && uploaders.length === 1))) {
          targetInput = input;
          targetUploader = uploader;
          break;
        }
      }

      if (!targetInput) {
        // Fallback to first file input
        targetInput = document.querySelector('input[type="file"]');
        targetUploader = targetInput?.closest('.ashby-application-form-autofill-uploader');
      }

      if (!targetInput) {
        console.error("🎨 No file input found for Ashby");
        window.dispatchEvent(new CustomEvent('AUTOJOBS_ASHBY_RESULT', { detail: { success: false } }));
        return;
      }

      console.log("🎨 Found target input:", targetInput);

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

      // Method 1: Try to find React fiber and call onChange
      let reactHandlerCalled = false;
      const reactKeys = Object.keys(targetInput).filter(key => 
        key.startsWith('__reactFiber$') || 
        key.startsWith('__reactInternalInstance$') ||
        key.startsWith('__reactProps$')
      );

      for (const reactKey of reactKeys) {
        try {
          let fiber = targetInput[reactKey];
          for (let i = 0; i < 25 && fiber; i++) {
            const props = fiber.memoizedProps || fiber.pendingProps;
            if (props?.onChange && typeof props.onChange === 'function') {
              console.log("🎨 Found onChange at fiber depth", i);
              
              // Create a synthetic event that mimics React's SyntheticEvent
              const syntheticEvent = {
                target: targetInput,
                currentTarget: targetInput,
                type: 'change',
                bubbles: true,
                cancelable: false,
                defaultPrevented: false,
                eventPhase: 3,
                isTrusted: true,
                nativeEvent: new Event('change', { bubbles: true }),
                preventDefault: function() { this.defaultPrevented = true; },
                stopPropagation: function() {},
                persist: function() {},
                timeStamp: Date.now()
              };
              
              props.onChange(syntheticEvent);
              reactHandlerCalled = true;
              console.log("🎨 Called onChange handler");
              break;
            }
            
            // Also check stateNode.props
            if (fiber.stateNode?.props?.onChange && typeof fiber.stateNode.props.onChange === 'function') {
              console.log("🎨 Found onChange on stateNode at depth", i);
              const syntheticEvent = {
                target: targetInput,
                currentTarget: targetInput,
                type: 'change',
                bubbles: true,
                nativeEvent: new Event('change', { bubbles: true }),
                preventDefault: function() {},
                stopPropagation: function() {},
                persist: function() {}
              };
              fiber.stateNode.props.onChange(syntheticEvent);
              reactHandlerCalled = true;
              break;
            }
            
            fiber = fiber.return;
          }
          if (reactHandlerCalled) break;
        } catch (e) {
          console.warn("🎨 Error accessing React fiber:", e);
        }
      }

      // Method 2: Dispatch native events with proper configuration
      const dispatchEvents = () => {
        const eventTypes = ['input', 'change'];
        for (const eventType of eventTypes) {
          const event = new Event(eventType, { bubbles: true, cancelable: true });
          Object.defineProperty(event, 'target', { value: targetInput, enumerable: true });
          targetInput.dispatchEvent(event);
        }
      };
      
      dispatchEvents();
      await new Promise(r => setTimeout(r, 100));
      dispatchEvents();

      // Method 3: Try to click the upload area or trigger drag-drop
      if (targetUploader) {
        // Look for the drag layer and trigger events on it
        const dragLayer = targetUploader.querySelector('[class*="drag-layer"]');
        if (dragLayer) {
          console.log("🎨 Found drag layer, triggering drop events");
          
          // Create a DataTransfer for drag events
          const dragDt = new DataTransfer();
          dragDt.items.add(file);
          
          const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: dragDt
          });
          
          dragLayer.dispatchEvent(dropEvent);
        }

        // Also trigger on the uploader container itself
        targetUploader.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Method 4: Check for internal React hooks via __REACT_DEVTOOLS_GLOBAL_HOOK__
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers) {
        console.log("🎨 Trying React DevTools hook");
        try {
          const renderers = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers;
          renderers.forEach((renderer) => {
            if (renderer.findFiberByHostInstance) {
              const fiber = renderer.findFiberByHostInstance(targetInput);
              if (fiber) {
                let current = fiber;
                for (let i = 0; i < 25 && current; i++) {
                  const props = current.memoizedProps || current.pendingProps;
                  if (props?.onChange) {
                    console.log("🎨 Found onChange via DevTools at depth", i);
                    props.onChange({ target: targetInput, currentTarget: targetInput });
                    break;
                  }
                  current = current.return;
                }
              }
            }
          });
        } catch (e) {
          console.warn("🎨 DevTools hook error:", e);
        }
      }

      // Wait for UI to update
      await new Promise(r => setTimeout(r, 300));

      // Check if the state changed (look for data-state change or button text change)
      const rootDiv = targetInput.closest('[data-state]');
      const stateChanged = rootDiv?.getAttribute('data-state') !== 'default';
      
      // Also check if pending layer became visible
      const pendingLayer = targetUploader?.querySelector('[class*="pending-layer"]');
      const pendingVisible = pendingLayer?.getAttribute('data-state') !== 'hidden';

      console.log("🎨 Upload result - reactHandlerCalled:", reactHandlerCalled, "stateChanged:", stateChanged, "pendingVisible:", pendingVisible);

      window.dispatchEvent(new CustomEvent('AUTOJOBS_ASHBY_RESULT', { 
        detail: { success: reactHandlerCalled || stateChanged || pendingVisible } 
      }));

    } catch (error) {
      console.error("🎨 Ashby upload error:", error);
      window.dispatchEvent(new CustomEvent('AUTOJOBS_ASHBY_RESULT', { detail: { success: false, error: error.message } }));
    }
  });

  console.log("🎨 Ashby inject script ready");
})();
