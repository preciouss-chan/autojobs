// Page context script for Greenhouse React file uploads
(function() {
  'use strict';
  
  window.addEventListener('AUTOJOBS_UPLOAD_FILE', async function(e) {
    const { fileData, fileName, fileType, mimeType, inputId } = e.detail;
    
    try {
      // Convert base64 to File
      const byteCharacters = atob(fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      const file = new File([blob], fileName, { type: mimeType });
      
      // Find the input
      let input = document.getElementById(inputId);
      if (!input) {
        const selectors = [
          `input[type=file][name*="${fileType}"]`,
          `input[type=file][id*="${fileType}"]`,
          `input[type=file][data-field-name*="${fileType}"]`
        ];
        for (const selector of selectors) {
          input = document.querySelector(selector);
          if (input) break;
        }
      }
      
      if (!input) {
        window.dispatchEvent(new CustomEvent('AUTOJOBS_UPLOAD_RESULT', { 
          detail: { success: false, error: 'Input not found', fileType } 
        }));
        return;
      }
      
      // Set the file using DataTransfer
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      
      // Find and call React's onChange handler
      let onChangeCalled = false;
      const reactKeys = Object.keys(input).filter(key => 
        key.startsWith('__reactFiber$') || 
        key.startsWith('__reactInternalInstance$') ||
        key.startsWith('__reactProps$')
      );
      
      const syntheticEvent = {
        target: input,
        currentTarget: input,
        type: 'change',
        bubbles: true,
        cancelable: false,
        defaultPrevented: false,
        eventPhase: 2,
        isTrusted: true,
        nativeEvent: new Event('change', { bubbles: true }),
        preventDefault: function() {},
        stopPropagation: function() {},
        persist: function() {},
        isPersistent: function() { return true; }
      };
      
      // Walk React fiber tree to find onChange handlers
      for (const key of reactKeys) {
        if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
          let fiber = input[key];
          let depth = 0;
          
          while (fiber && depth < 50) {
            if (fiber.memoizedProps?.onChange) {
              try { fiber.memoizedProps.onChange(syntheticEvent); onChangeCalled = true; } catch (e) {}
            }
            if (fiber.pendingProps?.onChange) {
              try { fiber.pendingProps.onChange(syntheticEvent); onChangeCalled = true; } catch (e) {}
            }
            if (fiber.stateNode?.props?.onChange) {
              try { fiber.stateNode.props.onChange(syntheticEvent); onChangeCalled = true; } catch (e) {}
            }
            
            const handlers = ['onFileSelect', 'onFilesChange', 'handleFileChange', 'handleChange', 'onDrop'];
            for (const name of handlers) {
              if (fiber.memoizedProps?.[name]) {
                try { fiber.memoizedProps[name](syntheticEvent); onChangeCalled = true; } catch (e) {}
              }
            }
            
            fiber = fiber.return;
            depth++;
          }
          break;
        }
      }
      
      // Also check reactProps directly
      const propsKey = Object.keys(input).find(k => k.startsWith('__reactProps$'));
      if (propsKey && input[propsKey]?.onChange) {
        try { input[propsKey].onChange(syntheticEvent); onChangeCalled = true; } catch (e) {}
      }
      
      // Dispatch native events as backup
      try { input.focus(); } catch (e) {}
      input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      
      const wrapper = input.closest('.file-upload_wrapper') || input.closest('.file-upload');
      const label = input.closest('label') || document.querySelector(`label[for="${input.id}"]`);
      
      [wrapper, label, input.parentElement].filter(Boolean).forEach(el => {
        try {
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new CustomEvent('file-selected', { bubbles: true, detail: { files: input.files } }));
        } catch (e) {}
      });
      
      // Delayed event dispatches
      setTimeout(() => {
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        try { input.blur(); } catch (e) {}
      }, 50);
      
      setTimeout(() => input.dispatchEvent(new Event('change', { bubbles: true })), 150);
      
      setTimeout(() => {
        input.dispatchEvent(new Event('change', { bubbles: true }));
        const form = input.closest('form');
        if (form) form.dispatchEvent(new Event('change', { bubbles: true }));
      }, 300);
      
      // Update UI
      updateGreenhouseUI(input, fileName, fileType);
      
      const success = input.files.length > 0 && input.files[0].name === fileName;
      window.dispatchEvent(new CustomEvent('AUTOJOBS_UPLOAD_RESULT', { 
        detail: { success, onChangeCalled, filesSet: input.files.length > 0, fileName: input.files[0]?.name, fileType } 
      }));
      
    } catch (error) {
      window.dispatchEvent(new CustomEvent('AUTOJOBS_UPLOAD_RESULT', { 
        detail: { success: false, error: error.message, fileType } 
      }));
    }
  });
  
  function updateGreenhouseUI(input, fileName, fileType) {
    const wrapper = input.closest('.file-upload_wrapper') || 
                    input.closest('.file-upload') ||
                    input.closest('[class*="file-upload"]') ||
                    input.closest('[class*="FileUpload"]');
    
    if (wrapper) {
      const filenameElements = wrapper.querySelectorAll('.file-upload__filename, [class*="filename"], .selected-file, .file-name');
      filenameElements.forEach(el => el.textContent = fileName);
      
      const attachBtns = wrapper.querySelectorAll('.btn--pill, [class*="attach"], button');
      attachBtns.forEach(btn => {
        if (btn.textContent.toLowerCase().includes('attach')) btn.style.display = 'none';
      });
      
      let filenameDisplay = wrapper.querySelector('.autojobs-filename');
      if (!filenameDisplay) {
        filenameDisplay = document.createElement('div');
        filenameDisplay.className = 'autojobs-filename';
        filenameDisplay.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 10px; background: #e8f5e9; border-radius: 4px; color: #2e7d32; font-size: 14px;';
        filenameDisplay.innerHTML = `<span style="color: #4caf50;">✓</span> ${fileName}`;
        if (input.nextElementSibling) {
          input.parentNode.insertBefore(filenameDisplay, input.nextElementSibling);
        } else {
          wrapper.appendChild(filenameDisplay);
        }
      } else {
        filenameDisplay.innerHTML = `<span style="color: #4caf50;">✓</span> ${fileName}`;
      }
    } else {
      let indicator = document.querySelector('.autojobs-indicator-' + fileType);
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'autojobs-indicator-' + fileType;
        indicator.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: #e8f5e9; border-radius: 4px; color: #2e7d32; font-size: 13px; margin: 4px 0;';
        indicator.innerHTML = `<span style="color: #4caf50; font-weight: bold;">✓</span> ${fileName}`;
        const fieldContainer = input.closest('.field') || input.closest('[class*="field"]') || input.closest('.form-group') || input.parentElement;
        if (fieldContainer) fieldContainer.appendChild(indicator);
      } else {
        indicator.innerHTML = `<span style="color: #4caf50; font-weight: bold;">✓</span> ${fileName}`;
      }
    }
  }
})();
