import time
import requests
import feedparser
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Simple in-memory cache
cache = {
    "data": None,
    "last_updated": 0,
    "timeout": 300  # 5 minutes
}

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def parse_release_notes_feed():
    """Fetches and parses the BigQuery release notes RSS feed."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(FEED_URL, headers=headers, timeout=10)
        response.raise_for_status()
        
        feed = feedparser.parse(response.content)
        parsed_entries = []
        
        for entry in feed.entries:
            date_str = entry.get('title', 'Unknown Date')
            updated_str = entry.get('updated', '')
            base_link = entry.get('link', 'https://docs.cloud.google.com/bigquery/docs/release-notes')
            summary_html = entry.get('summary', '') or entry.get('description', '')
            
            # Extract ID anchor if possible
            entry_id = entry.get('id', '')
            anchor = ""
            if "#" in entry_id:
                anchor = entry_id.split("#")[-1]
            elif "#" in base_link:
                anchor = base_link.split("#")[-1]
            else:
                # Fallback to date slug
                anchor = date_str.replace(",", "").replace(" ", "_")
                
            # If the base link does not have an anchor, append it
            item_link = base_link
            if anchor and "#" not in item_link:
                item_link = f"{item_link}#{anchor}"

            soup = BeautifulSoup(summary_html, 'html.parser')
            items = []
            
            current_type = "General"
            current_elements = []
            
            # Helper to commit current block of elements
            def commit_item(item_type, elements):
                if not elements:
                    return
                # Reconstruct HTML
                html_content = "".join(str(el) for el in elements)
                # Text content
                text_content = "".join(el.get_text() if hasattr(el, 'get_text') else str(el) for el in elements).strip()
                # Clean up multiple newlines
                text_content = " ".join(text_content.split())
                
                # Check for category-specific links
                # If there are links inside this block, keep track of them
                links = []
                for el in elements:
                    if hasattr(el, 'find_all'):
                        for a in el.find_all('a', href=True):
                            links.append({"text": a.get_text(), "url": a['href']})
                
                items.append({
                    "type": item_type,
                    "html": html_content,
                    "text": text_content,
                    "links": links
                })

            # Traverse the feed entry nodes
            for child in soup.contents:
                if isinstance(child, str) and not child.strip():
                    continue
                    
                if child.name == 'h3':
                    # Commit previous block if it exists
                    commit_item(current_type, current_elements)
                    # Reset for new block
                    current_type = child.get_text().strip()
                    current_elements = []
                else:
                    current_elements.append(child)
                    
            # Commit the last remaining block
            commit_item(current_type, current_elements)
            
            parsed_entries.append({
                "date": date_str,
                "updated": updated_str,
                "link": item_link,
                "anchor": anchor,
                "items": items
            })
            
        return {
            "success": True,
            "entries": parsed_entries,
            "fetched_at": time.time()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "fetched_at": time.time()
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    current_time = time.time()
    
    # Check if cache is valid and refresh not forced
    if not force_refresh and cache["data"] and (current_time - cache["last_updated"] < cache["timeout"]):
        return jsonify({
            **cache["data"],
            "cached": True,
            "cache_expires_in": int(cache["timeout"] - (current_time - cache["last_updated"]))
        })
        
    # Fetch and parse
    result = parse_release_notes_feed()
    
    if result["success"]:
        cache["data"] = result
        cache["last_updated"] = current_time
        return jsonify({
            **result,
            "cached": False
        })
    else:
        # If fetch fails but we have cached data, return cached data with an error warning
        if cache["data"]:
            return jsonify({
                **cache["data"],
                "cached": True,
                "warning": f"Failed to refresh feed: {result['error']}. Displaying cached data."
            })
        return jsonify(result), 500

if __name__ == '__main__':
    # Run the server on port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
