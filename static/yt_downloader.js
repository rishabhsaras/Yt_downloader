// --- Element Selections ---
let body = document.querySelector("body");
let theme = document.querySelector(".toggle-btn");
let count = 1;
let tag = document.querySelectorAll(".tags");
let featureSection = document.querySelector("#features-section");
let footerTags = document.querySelectorAll(".footer-links a");
let copyRight = document.querySelector(".footer-copyright");
let inpt = document.querySelector("#urlInput");
let warning = document.querySelector(".warning_content");
let downloadButtons = document.querySelectorAll(".download-hero-btn, .download-btn");

// --- Theme Toggle (Unchanged) ---
theme.addEventListener("click", () => {
  if (count) {
    body.classList.add("dark");
    body.classList.remove("light");
    theme.innerHTML = '<i class="ri-moon-line"></i>';
    theme.style.borderColor = "#ffffff";
    featureSection.style.backgroundColor = "#14191f";
    tag.forEach((ele) => { ele.style.color = "#ffffff"; });
    copyRight.style.color = "#9dadbe";
    footerTags.forEach((elems) => { elems.style.color = '#9dadbe'; });
    count--;
  } else {
    body.classList.add("light");
    body.classList.remove("dark");
    theme.innerHTML = ' <i class="ri-sun-line"></i>';
    featureSection.style.backgroundColor = "#ffffff";
    footerTags.forEach((elems) => { elems.style.color = '#333'; });
    copyRight.style.color = "#333";
    tag.forEach((ele) => { ele.style.color = "#14191f"; });
    theme.style.borderColor = "#14191f";
    count++;
  }
});

// --- Helper function to show/hide a loading spinner ---
const showLoader = (show) => {
    let loader = document.getElementById('loader');
    if (show) {
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'loader';
            loader.innerHTML = '<div class="spinner"></div>';
            loader.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;';
            document.body.appendChild(loader);
            const style = document.createElement('style');
            style.innerHTML = `.spinner { border: 5px solid #f3f3f3; border-top: 5px solid #417dbd; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; } @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }
        loader.style.display = 'flex';
    } else {
        if (loader) loader.style.display = 'none';
    }
};

// --- Function to display quality options in a modal ---
const displayQualityOptions = (formats, url, thumbnailUrl) => {
    // Remove existing modal if any
    const existingModal = document.getElementById('quality-modal');
    if (existingModal) existingModal.remove();

    // Create modal elements
    const modal = document.createElement('div');
    modal.id = 'quality-modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 2000;';

    const modalContent = document.createElement('div');
    modalContent.style.cssText = 'background: #fff; color: #333; padding: 20px; border-radius: 8px; width: 90%; max-width: 400px; text-align: center;';
    
    if (thumbnailUrl) {
        const thumbnail = document.createElement('img');
        thumbnail.src = thumbnailUrl;
        thumbnail.style.cssText = 'width: 100%; max-width: 280px; border-radius: 8px; margin: 0 auto 15px; display: block;';
        modalContent.appendChild(thumbnail);
    }

    const title = document.createElement('h3');
    title.textContent = 'Select Video Quality';
    title.style.marginBottom = '15px';
    modalContent.appendChild(title);

    const list = document.createElement('ul');
    list.style.cssText = 'list-style: none; padding: 0; margin: 0; text-align: left;';
    
    formats.forEach(format => {
        const listItem = document.createElement('li');
        listItem.style.cssText = 'padding: 10px; border-bottom: 1px solid #eee; cursor: pointer;';
        listItem.textContent = `${format.resolution}p (${format.ext}) - ${format.filesize}`;
        listItem.onclick = () => {
            modal.remove();
            // Send the resolution to the download function
            triggerFinalDownload(url, format.resolution);
        };
        listItem.onmouseover = () => listItem.style.backgroundColor = '#f0f0f0';
        listItem.onmouseout = () => listItem.style.backgroundColor = 'transparent';
        list.appendChild(listItem);
    });

    modalContent.appendChild(list);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
};

// --- Function to trigger the final download ---
const triggerFinalDownload = async (url, resolution) => {
    showLoader(true);
    try {
        const response = await fetch('http://127.0.0.1:5000/api/download-selected-format', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Send the resolution to the server
            body: JSON.stringify({ url, resolution }),
        });

        if (response.ok) {
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            
            const contentDisposition = response.headers.get('content-disposition');
            let filename = 'video.mp4';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
                if (filenameMatch && filenameMatch.length > 1) {
                    filename = filenameMatch[1];
                }
            }
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            a.remove();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Could not download the selected format.');
        }
    } catch (error) {
        console.error('Final Download Error:', error);
        warning.innerHTML = `<i class="ri-close-circle-fill"></i> Error: ${error.message}`;
        warning.style.visibility = "visible";
        setTimeout(() => { warning.style.visibility = "hidden"; }, 5000);
    } finally {
        showLoader(false);
    }
};

// --- Main function to start the process ---
const startDownloadProcess = async () => {
  const url = inpt.value.trim();

  // 1. Validate URL
  if (url === "") {
    warning.style.visibility = "visible";
    setTimeout(() => { warning.style.visibility = "hidden"; }, 3000);
    return;
  }
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
  if (!url.match(youtubeRegex)) {
    warning.innerHTML = '<i class="ri-close-circle-fill"></i> Please enter a valid YouTube URL.';
    warning.style.visibility = "visible";
    setTimeout(() => {
        warning.style.visibility = "hidden";
        warning.innerHTML = '<i class="ri-close-circle-fill"></i> Please fill out this field before proceeding.';
    }, 3000);
    return;
  }

  // 2. Fetch formats from the server
  showLoader(true);
  try {
    const response = await fetch('http://127.0.0.1:5000/api/get-formats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (response.ok) {
      const data = await response.json();
      displayQualityOptions(data.formats, url, data.thumbnail_url);
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Could not fetch video formats.');
    }
  } catch (error) {
    console.error('Fetch Formats Error:', error);
    warning.innerHTML = `<i class="ri-close-circle-fill"></i> Error: ${error.message}`;
    warning.style.visibility = "visible";
    setTimeout(() => { warning.style.visibility = "hidden"; }, 5000);
  } finally {
    showLoader(false);
  }
};

// Add the event listener to all download buttons
downloadButtons.forEach(button => {
  button.addEventListener("click", startDownloadProcess);
});
