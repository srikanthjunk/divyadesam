#!/bin/bash

# Security Remediation Script - Remove Hardcoded API Keys
# This script removes all hardcoded API keys and replaces them with environment variable references

set -e

echo "🔐 Security Remediation: Removing Hardcoded API Keys"
echo "===================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to backup a file
backup_file() {
    local file=$1
    if [ -f "$file" ]; then
        cp "$file" "$file.backup-$(date +%Y%m%d-%H%M%S)"
        echo -e "${GREEN}✓${NC} Backed up: $file"
    fi
}

# Function to update a file with environment variable
update_file() {
    local file=$1
    local old_pattern=$2
    local new_line=$3

    if [ -f "$file" ]; then
        backup_file "$file"

        # Use perl for in-place editing (works on both Linux and macOS)
        perl -i -pe "s/$old_pattern/$new_line/g" "$file"

        echo -e "${GREEN}✓${NC} Updated: $file"
    else
        echo -e "${YELLOW}⚠${NC}  File not found: $file"
    fi
}

echo "Step 1: Backing up files..."
echo "----------------------------"

# Fix Node.js files (temple-importer/*.mjs)
echo ""
echo "Step 2: Fixing Node.js files..."
echo "--------------------------------"

# Update gemini_batch_enricher.mjs
if [ -f "temple-importer/gemini_batch_enricher.mjs" ]; then
    backup_file "temple-importer/gemini_batch_enricher.mjs"
    sed -i.bak "s/const GEMINI_API_KEY = '[^']*';/const GEMINI_API_KEY = process.env.GEMINI_API_KEY;/" temple-importer/gemini_batch_enricher.mjs
    echo -e "${GREEN}✓${NC} Updated: temple-importer/gemini_batch_enricher.mjs"
fi

# Update gemini_comprehensive_enricher.mjs
if [ -f "temple-importer/gemini_comprehensive_enricher.mjs" ]; then
    backup_file "temple-importer/gemini_comprehensive_enricher.mjs"
    sed -i.bak "s/const GEMINI_API_KEY = '[^']*';/const GEMINI_API_KEY = process.env.GEMINI_API_KEY;/" temple-importer/gemini_comprehensive_enricher.mjs
    echo -e "${GREEN}✓${NC} Updated: temple-importer/gemini_comprehensive_enricher.mjs"
fi

# Update gemini_simple_test.mjs
if [ -f "temple-importer/gemini_simple_test.mjs" ]; then
    backup_file "temple-importer/gemini_simple_test.mjs"
    sed -i.bak "s/const GEMINI_API_KEY = '[^']*';/const GEMINI_API_KEY = process.env.GEMINI_API_KEY;/" temple-importer/gemini_simple_test.mjs
    echo -e "${GREEN}✓${NC} Updated: temple-importer/gemini_simple_test.mjs"
fi

# Update gemini_location_enhancer.mjs
if [ -f "temple-importer/gemini_location_enhancer.mjs" ]; then
    backup_file "temple-importer/gemini_location_enhancer.mjs"
    sed -i.bak "s/const GEMINI_API_KEY = '[^']*';/const GEMINI_API_KEY = process.env.GEMINI_API_KEY;/" temple-importer/gemini_location_enhancer.mjs
    echo -e "${GREEN}✓${NC} Updated: temple-importer/gemini_location_enhancer.mjs"
fi

# Update debug_gemini.mjs
if [ -f "temple-importer/debug_gemini.mjs" ]; then
    backup_file "temple-importer/debug_gemini.mjs"
    sed -i.bak "s/const GEMINI_API_KEY = '[^']*';/const GEMINI_API_KEY = process.env.GEMINI_API_KEY;/" temple-importer/debug_gemini.mjs
    echo -e "${GREEN}✓${NC} Updated: temple-importer/debug_gemini.mjs"
fi

# Update update-all-coordinates.js
if [ -f "update-all-coordinates.js" ]; then
    backup_file "update-all-coordinates.js"
    sed -i.bak "s/const HERE_API_KEY = '[^']*';/const HERE_API_KEY = process.env.HERE_API_KEY;/" update-all-coordinates.js
    echo -e "${GREEN}✓${NC} Updated: update-all-coordinates.js"
fi

# Update coordinate-update-script.js
if [ -f "coordinate-update-script.js" ]; then
    backup_file "coordinate-update-script.js"
    sed -i.bak "s/const HERE_API_KEY = '[^']*';/const HERE_API_KEY = process.env.HERE_API_KEY;/" coordinate-update-script.js
    echo -e "${GREEN}✓${NC} Updated: coordinate-update-script.js"
fi

# Fix HTML file (location-search-test.html)
echo ""
echo "Step 3: Fixing HTML files..."
echo "----------------------------"

if [ -f "location-search-test.html" ]; then
    backup_file "location-search-test.html"
    # For HTML, we'll comment out the key and add instruction
    sed -i.bak "s/const OPENROUTE_API_KEY = '[^']*';/\/\/ const OPENROUTE_API_KEY = 'MOVED_TO_ENV'; \/\/ TODO: Load from config or remove this test file/" location-search-test.html
    echo -e "${GREEN}✓${NC} Updated: location-search-test.html"
    echo -e "${YELLOW}⚠${NC}  Note: location-search-test.html is a browser-based test file"
    echo -e "   Consider moving to a Node.js script or removing if not needed"
fi

# Clean up .bak files created by sed
echo ""
echo "Step 4: Cleaning up..."
echo "----------------------"
find . -name "*.bak" -type f -delete
echo -e "${GREEN}✓${NC} Removed temporary .bak files"

echo ""
echo "Step 5: Verifying .env file..."
echo "-------------------------------"

if [ ! -f "temple-importer/.env" ]; then
    echo -e "${RED}✗${NC} .env file not found!"
    echo "Creating template .env file..."
    cat > temple-importer/.env << 'EOF'
# Supabase Configuration
SUPABASE_URL=https://yxsnfxiebolatzhkhbyi.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_key_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Email Configuration
RESEND_API_KEY=your_resend_api_key_here
ALERTS_FROM="Temple Alerts <alerts@communityforge.info>"

# API Keys (ADD YOUR NEW KEYS HERE)
GEMINI_API_KEY=your_new_gemini_api_key_here
HERE_API_KEY=your_new_here_api_key_here
OPENROUTE_API_KEY=your_new_openroute_api_key_here
EOF
    echo -e "${GREEN}✓${NC} Created template .env file"
    echo -e "${YELLOW}⚠${NC}  Please edit temple-importer/.env and add your NEW API keys"
else
    echo -e "${GREEN}✓${NC} .env file exists"

    # Check if keys are already in .env
    if ! grep -q "GEMINI_API_KEY" temple-importer/.env; then
        echo "" >> temple-importer/.env
        echo "# API Keys" >> temple-importer/.env
        echo "GEMINI_API_KEY=your_new_gemini_api_key_here" >> temple-importer/.env
        echo -e "${GREEN}✓${NC} Added GEMINI_API_KEY to .env"
    fi

    if ! grep -q "HERE_API_KEY" temple-importer/.env; then
        echo "HERE_API_KEY=your_new_here_api_key_here" >> temple-importer/.env
        echo -e "${GREEN}✓${NC} Added HERE_API_KEY to .env"
    fi

    if ! grep -q "OPENROUTE_API_KEY" temple-importer/.env; then
        echo "OPENROUTE_API_KEY=your_new_openroute_api_key_here" >> temple-importer/.env
        echo -e "${GREEN}✓${NC} Added OPENROUTE_API_KEY to .env"
    fi
fi

echo ""
echo "Step 6: Checking for remaining hardcoded keys..."
echo "-------------------------------------------------"

# Search for potential remaining keys (excluding .env and backups)
REMAINING=$(grep -r "AIzaSy\|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\|eyJvcmciO" . \
    --exclude-dir=node_modules \
    --exclude-dir=.git \
    --exclude="*.backup-*" \
    --exclude=".env" \
    --exclude=".env.example" \
    --exclude="remove-hardcoded-keys.sh" \
    2>/dev/null | grep -v "SUPABASE_ANON_KEY" || true)

if [ -z "$REMAINING" ]; then
    echo -e "${GREEN}✓${NC} No remaining hardcoded keys found (excluding safe Supabase anon key)"
else
    echo -e "${YELLOW}⚠${NC}  Found potential keys in:"
    echo "$REMAINING"
fi

echo ""
echo "===================================================="
echo -e "${GREEN}✓ Script completed!${NC}"
echo "===================================================="
echo ""
echo "📋 NEXT STEPS - CRITICAL:"
echo ""
echo "1. ${RED}REVOKE OLD API KEYS IMMEDIATELY:${NC}"
echo "   - Google Gemini: https://console.cloud.google.com/apis/credentials"
echo "   - HERE Maps: https://platform.here.com/admin/apps"
echo ""
echo "2. ${YELLOW}Generate NEW API keys${NC} (after revoking old ones)"
echo ""
echo "3. ${YELLOW}Edit temple-importer/.env${NC} and add your NEW keys:"
echo "   nano temple-importer/.env"
echo ""
echo "4. ${YELLOW}Test your scripts${NC} to ensure they work with env variables:"
echo "   cd temple-importer"
echo "   node gemini_simple_test.mjs"
echo ""
echo "5. ${YELLOW}Commit the changes:${NC}"
echo "   git add ."
echo "   git commit -m 'Security: Remove hardcoded API keys, use environment variables'"
echo ""
echo "6. ${RED}REWRITE GIT HISTORY${NC} to remove old keys from all commits:"
echo "   See SECURITY_REMEDIATION.md for detailed instructions"
echo ""
echo "7. ${RED}Force push to GitHub${NC} (after rewriting history):"
echo "   git push origin --force --all"
echo ""
echo "📁 Backup files saved with timestamp (*.backup-YYYYMMDD-HHMMSS)"
echo ""
