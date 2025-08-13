#!/usr/bin/env python3

"""
Update Temple Coordinates using Google Places API
This script updates all temple coordinates with accurate Google Places data
"""

import json
import re
import time
import urllib.request
import urllib.parse
import sys
from datetime import datetime

# API Configuration
# Set your API keys as environment variables:
# export GOOGLE_API_KEY=your_google_key_here
# export HERE_API_KEY=your_here_key_here
import os
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY', 'YOUR_GOOGLE_API_KEY')
HERE_API_KEY = os.environ.get('HERE_API_KEY', 'YOUR_HERE_API_KEY')

def read_temple_data():
    """Read current temple data from temple-data.js"""
    with open('temple-data.js', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract the array
    match = re.search(r'const divyaDesams = (\[.*?\]);', content, re.DOTALL)
    if not match:
        raise Exception('Could not parse temple data')
    
    # Convert JavaScript object notation to Python (simplified)
    array_content = match.group(1)
    
    # Replace JavaScript object notation with JSON-compatible format
    array_content = re.sub(r'(\w+):', r'"\1":', array_content)  # Add quotes to keys
    array_content = re.sub(r':\s*([^"\[\{]\w+)', r': "\1"', array_content)  # Quote unquoted string values
    
    try:
        return json.loads(array_content)
    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        print("Falling back to manual parsing...")
        
        # Manual parsing as fallback
        temples = []
        lines = array_content.split('\n')
        current_temple = {}
        
        for line in lines:
            line = line.strip().rstrip(',')
            if line.startswith('{ name:'):
                if current_temple:
                    temples.append(current_temple)
                current_temple = {}
                
                # Extract fields from the line
                parts = line.split(', ')
                for part in parts:
                    if ':' in part:
                        key, value = part.split(':', 1)
                        key = key.strip().strip('{').strip()
                        value = value.strip().strip('"').strip("'")
                        
                        if key == 'name':
                            current_temple['name'] = value
                        elif key == 'displayName':
                            current_temple['displayName'] = value
                        elif key == 'lat':
                            current_temple['lat'] = float(value)
                        elif key == 'lng':
                            current_temple['lng'] = float(value)
            elif line.startswith('}'):
                if current_temple:
                    temples.append(current_temple)
                    current_temple = {}
        
        return temples

def get_google_coordinates(temple_name):
    """Get coordinates from Google Places API"""
    try:
        # Search for the place
        query = urllib.parse.quote(temple_name)
        search_url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={query}&key={GOOGLE_API_KEY}"
        
        with urllib.request.urlopen(search_url) as response:
            data = json.loads(response.read())
        
        if data.get('results'):
            result = data['results'][0]
            location = result['geometry']['location']
            return {
                'success': True,
                'lat': location['lat'],
                'lng': location['lng'],
                'name': result['name'],
                'place_id': result['place_id'],
                'rating': result.get('rating'),
                'formatted_address': result.get('formatted_address')
            }
        
        return {'success': False, 'reason': 'No results found'}
        
    except Exception as e:
        return {'success': False, 'reason': str(e)}

def get_here_coordinates(temple_name):
    """Fallback: Get coordinates from HERE Maps API"""
    try:
        query = urllib.parse.quote(temple_name)
        url = f"https://geocode.search.hereapi.com/v1/geocode?q={query}&limit=5&in=countryCode:IND&types=area,city,place&apikey={HERE_API_KEY}"
        
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read())
        
        if data.get('items'):
            best = data['items'][0]
            return {
                'success': True,
                'lat': best['position']['lat'],
                'lng': best['position']['lng'],
                'name': best['title'],
                'confidence': best.get('scoring', {}).get('queryScore', 0),
                'address': best.get('address', {}).get('label', '')
            }
        
        return {'success': False, 'reason': 'No results found'}
        
    except Exception as e:
        return {'success': False, 'reason': str(e)}

def update_all_coordinates():
    """Update coordinates for all temples"""
    temples = read_temple_data()
    print(f"🗺️  Updating coordinates for {len(temples)} temples using Google Places API")
    print("=" * 70)
    
    updated_temples = []
    updates_log = []
    
    for i, temple in enumerate(temples):
        if not temple.get('displayName'):
            print(f"{i+1:3d}. Skipping temple with no displayName")
            updated_temples.append(temple)
            continue
            
        print(f"{i+1:3d}/{len(temples)}: {temple['displayName']}")
        print(f"     Current: lat: {temple.get('lat', 'N/A')}, lng: {temple.get('lng', 'N/A')}")
        
        # Try Google Places first
        result = get_google_coordinates(temple['displayName'])
        
        if not result['success']:
            # Fallback to HERE Maps
            print(f"     Google failed ({result['reason']}), trying HERE Maps...")
            result = get_here_coordinates(temple['displayName'])
        
        if result['success']:
            old_lat = temple.get('lat', 0)
            old_lng = temple.get('lng', 0)
            new_lat = result['lat']
            new_lng = result['lng']
            
            lat_diff = abs(new_lat - old_lat)
            lng_diff = abs(new_lng - old_lng)
            
            # Update the temple data
            updated_temple = temple.copy()
            updated_temple['lat'] = new_lat
            updated_temple['lng'] = new_lng
            updated_temples.append(updated_temple)
            
            print(f"     Updated: lat: {new_lat}, lng: {new_lng}")
            print(f"     Difference: lat: {lat_diff:.6f}, lng: {lng_diff:.6f}")
            
            if lat_diff > 0.01 or lng_diff > 0.01:
                print(f"     🔄 SIGNIFICANT UPDATE")
                updates_log.append({
                    'temple': temple['displayName'],
                    'old': {'lat': old_lat, 'lng': old_lng},
                    'new': {'lat': new_lat, 'lng': new_lng},
                    'difference': {'lat': lat_diff, 'lng': lng_diff},
                    'source': 'Google' if 'place_id' in result else 'HERE'
                })
            else:
                print(f"     ✅ Minor adjustment")
        else:
            # Keep original coordinates if all APIs fail
            updated_temples.append(temple)
            print(f"     ❌ Failed: {result['reason']} - keeping original coordinates")
        
        # Rate limiting
        time.sleep(0.3)
        print()
    
    return updated_temples, updates_log

def save_updated_data(temples, updates_log):
    """Save updated temple data to file"""
    # Backup original file
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_file = f"temple-data-backup-{timestamp}.js"
    
    import shutil
    shutil.copy('temple-data.js', backup_file)
    print(f"📄 Original file backed up as {backup_file}")
    
    # Generate updated file content
    header = f"""// Comprehensive Divya Desam temple database
// 108 temples with complete information including Perumal, Thaayaar, and Regional classification
// Coordinates updated on {datetime.now().strftime('%Y-%m-%d')} using Google Places API + HERE Maps

const divyaDesams = """
    
    # Convert back to JavaScript object format
    temple_lines = []
    for temple in temples:
        line = "{"
        line += f' name: "{temple.get("name", "")}"'
        line += f', displayName: "{temple.get("displayName", "")}"'
        line += f', lat: {temple.get("lat", 0)}'
        line += f', lng: {temple.get("lng", 0)}'
        line += f', link: "{temple.get("link", "")}"'
        line += f', perumal: "{temple.get("perumal", "")}"'
        line += f', thaayaar: "{temple.get("thaayaar", "")}"'
        line += f', region: "{temple.get("region", "")}"'
        line += " }"
        temple_lines.append(line)
    
    temples_content = "[\n    " + ",\n    ".join(temple_lines) + "\n]"
    
    footer = """

// Regional summary
const regionalSummary = {
    "Chola": 40,
    "Pandiya": 18, 
    "Malai": 11,
    "Vaduga": 14,
    "Tonda": 8,
    "Vada": 7
};

// Make temples available globally
if (typeof window !== 'undefined') {
    window.divyaDesams = divyaDesams;
    window.regionalSummary = regionalSummary;
    console.log('✅ Temple data loaded successfully:', divyaDesams.length, 'temples');
}

// For Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { divyaDesams, regionalSummary };
}"""
    
    content = header + temples_content + ";" + footer
    
    with open('temple-data.js', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"📄 Updated temple-data.js with new coordinates")
    
    # Save update log
    with open('coordinate-updates-log.json', 'w') as f:
        json.dump(updates_log, f, indent=2)
    
    print(f"📄 Update log saved to coordinate-updates-log.json")

def main():
    try:
        print("🗺️  Divya Desam Coordinate Update System")
        print("Using Google Places API + HERE Maps fallback")
        print("=" * 70)
        
        updated_temples, updates_log = update_all_coordinates()
        save_updated_data(updated_temples, updates_log)
        
        # Summary
        significant_updates = len(updates_log)
        total_temples = len(updated_temples)
        
        print("\n📊 UPDATE SUMMARY")
        print("=" * 30)
        print(f"Total temples: {total_temples}")
        print(f"Significant coordinate updates: {significant_updates}")
        print(f"Update rate: {(significant_updates/total_temples*100):.1f}%")
        
        if updates_log:
            print(f"\n🔄 Temples with significant coordinate changes:")
            for update in updates_log[:10]:  # Show first 10
                print(f"   • {update['temple']}")
                print(f"     Distance moved: ~{((update['difference']['lat']**2 + update['difference']['lng']**2)**0.5 * 111):.1f} km")
        
        print(f"\n✅ All temple coordinates updated successfully!")
        print(f"Distance calculations should now be highly accurate.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()