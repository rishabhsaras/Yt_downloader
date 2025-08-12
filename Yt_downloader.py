# Import Flask and other necessary modules
from flask import Flask, request, jsonify, send_file, after_this_request, render_template
from flask_cors import CORS # Import CORS
import yt_dlp
import os

# --- Create the Flask App ---
app = Flask(__name__, template_folder='templates')
# Expose the Content-Disposition header so the browser can read the filename
CORS(app, expose_headers=['Content-Disposition'])

# --- Helper Functions (Unchanged) ---
def sanitize_filename(filename):
    """Removes illegal characters from a filename."""
    illegal_chars = r'<>:"/\|?*'
    for char in illegal_chars:
        filename = filename.replace(char, '')
    return filename

def format_filesize(size_bytes):
    """Formats a size in bytes to a human-readable string (KB, MB, GB)."""
    if size_bytes is None: return "N/A"
    try: size_bytes = float(size_bytes)
    except (ValueError, TypeError): return "N/A"
    gb, mb, kb = 1024**3, 1024**2, 1024
    if size_bytes >= gb: return f"{size_bytes / gb:.2f} GB"
    if size_bytes >= mb: return f"{size_bytes / mb:.2f} MB"
    if size_bytes >= kb: return f"{size_bytes / kb:.2f} KB"
    return f"{int(size_bytes)} Bytes"

# --- Route to serve the main HTML page ---
@app.route('/')
def home():
    """Serves the main HTML file to the browser."""
    return render_template('index.html')

# --- Route to serve the contact page ---
@app.route('/contact')
def contact():
    """Serves the contact.html file."""
    return render_template('contact.html')


# --- API Endpoint 1: Get Available Formats (Unchanged) ---
@app.route('/api/get-formats', methods=['POST'])
def get_formats_route():
    try:
        data = request.get_json()
        url = data.get('url')
        if not url:
            return jsonify({'error': 'URL is required.'}), 400

        print(f"Fetching formats for: {url}")
        with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
            info = ydl.extract_info(url, download=False)
            formats = info.get('formats', [])
            thumbnail_url = info.get('thumbnail')
            
            video_formats = [f for f in formats if f.get('vcodec') != 'none' and f.get('height')]
            
            curated_formats = {}
            for f in video_formats:
                resolution = f.get('height')
                if resolution not in curated_formats:
                    curated_formats[resolution] = f
                else:
                    current_best = curated_formats[resolution]
                    new_has_size = f.get('filesize') or f.get('filesize_approx')
                    current_has_size = current_best.get('filesize') or current_best.get('filesize_approx')
                    if new_has_size and not current_has_size:
                        curated_formats[resolution] = f
                        continue
                    new_tbr = f.get('tbr', 0) or 0
                    current_tbr = current_best.get('tbr', 0) or 0
                    if new_tbr > current_tbr:
                        curated_formats[resolution] = f

            final_display_list = sorted(list(curated_formats.values()), key=lambda x: x.get('height', 0), reverse=True)
            
            response_data = [{
                'format_id': f.get('format_id'),
                'resolution': f.get('height'),
                'ext': f.get('ext'),
                'filesize': format_filesize(f.get('filesize') or f.get('filesize_approx'))
            } for f in final_display_list]

        return jsonify({
            'formats': response_data,
            'thumbnail_url': thumbnail_url
        })

    except Exception as e:
        print(f"An error occurred while fetching formats: {e}")
        return jsonify({'error': str(e)}), 500

# --- API Endpoint 2: Download the Selected Format ---
@app.route('/api/download-selected-format', methods=['POST'])
def download_selected_format_route():
    try:
        data = request.get_json()
        url = data.get('url')
        # --- FIX: Get the resolution from the request ---
        resolution = data.get('resolution')
        if not url or not resolution:
            return jsonify({'error': 'URL and resolution are required.'}), 400

        temp_dir = "temp_downloads"
        os.makedirs(temp_dir, exist_ok=True)
        output_template = os.path.join(temp_dir, '%(title)s.%(ext)s')

        # --- FIX: Use a more robust format selector based on the chosen resolution ---
        # This tells yt-dlp to find the best video up to the selected resolution and merge with the best audio.
        ydl_opts = {
            'format': f"bestvideo[height<={resolution}]+bestaudio/best[height<={resolution}]",
            'outtmpl': output_template,
            'merge_output_format': 'mp4',
            'quiet': True,
        }

        print(f"Downloading best video for resolution '{resolution}p' to server...")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            temp_filepath = ydl.prepare_filename(info)

        if not temp_filepath or not os.path.exists(temp_filepath):
            raise RuntimeError("Failed to download the video file to the server.")

        final_filename = f"{sanitize_filename(info.get('title', 'video'))}.mp4"

        @after_this_request
        def cleanup(response):
            try:
                print(f"Cleaning up temporary file: {temp_filepath}")
                os.remove(temp_filepath)
            except Exception as e:
                print(f"Error during cleanup: {e}")
            return response

        print(f"Sending '{final_filename}' to user.")
        return send_file(
            temp_filepath,
            as_attachment=True,
            download_name=final_filename
        )

    except Exception as e:
        print(f"An error occurred during final download: {e}")
        return jsonify({'error': str(e)}), 500

# --- Start the Server ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)
