#!/bin/bash

# Git History Rewrite Script - Remove Exposed API Keys from All Commits
# WARNING: This will rewrite git history. Coordinate with all collaborators!

set -e

echo "🔥 Git History Rewrite - Remove Exposed API Keys"
echo "=================================================="
echo ""
echo "⚠️  WARNING: This will rewrite ALL git history!"
echo "⚠️  All commit hashes will change!"
echo "⚠️  Collaborators must re-clone or reset their repos!"
echo ""

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# Confirm before proceeding
read -p "Have you already REVOKED the old API keys? (yes/no): " confirm_revoke
if [ "$confirm_revoke" != "yes" ]; then
    echo -e "${RED}✗${NC} Please revoke old API keys BEFORE rewriting history!"
    echo "1. Revoke Google Gemini key: https://console.cloud.google.com/apis/credentials"
    echo "2. Revoke HERE Maps key: https://platform.here.com/admin/apps"
    echo "3. Generate NEW keys and add to .env"
    exit 1
fi

echo ""
read -p "Do you understand this will change ALL commit hashes? (yes/no): " confirm_understand
if [ "$confirm_understand" != "yes" ]; then
    echo -e "${YELLOW}Cancelled.${NC}"
    exit 0
fi

echo ""
echo "Creating backup of current repository..."
cd ..
BACKUP_DIR="divyadesam-backup-$(date +%Y%m%d-%H%M%S)"
cp -r divyadesam "$BACKUP_DIR"
echo -e "${GREEN}✓${NC} Backup created: $BACKUP_DIR"
cd divyadesam

echo ""
echo "Step 1: Checking for BFG Repo-Cleaner..."
echo "-----------------------------------------"

if command -v bfg &> /dev/null; then
    echo -e "${GREEN}✓${NC} BFG found - using fast method"
    USE_BFG=true
else
    echo -e "${YELLOW}⚠${NC}  BFG not found - using git filter-branch (slower)"
    echo "To install BFG: brew install bfg (Mac) or download from https://rtyley.github.io/bfg-repo-cleaner/"
    USE_BFG=false
fi

echo ""
echo "Step 2: Removing files with exposed keys from git history..."
echo "-------------------------------------------------------------"

if [ "$USE_BFG" = true ]; then
    # Using BFG (faster)
    echo "Using BFG Repo-Cleaner..."

    # Create list of files to remove
    cat > /tmp/files-to-remove.txt << EOF
gemini_batch_enricher.mjs
gemini_comprehensive_enricher.mjs
gemini_simple_test.mjs
gemini_location_enhancer.mjs
debug_gemini.mjs
update-all-coordinates.js
coordinate-update-script.js
location-search-test.html
EOF

    bfg --delete-files "{gemini_batch_enricher.mjs,gemini_comprehensive_enricher.mjs,gemini_simple_test.mjs,gemini_location_enhancer.mjs,debug_gemini.mjs,update-all-coordinates.js,coordinate-update-script.js,location-search-test.html}"

else
    # Using git filter-branch (slower but built-in)
    echo "Using git filter-branch..."

    git filter-branch --force --index-filter \
        'git rm --cached --ignore-unmatch \
            temple-importer/gemini_batch_enricher.mjs \
            temple-importer/gemini_comprehensive_enricher.mjs \
            temple-importer/gemini_simple_test.mjs \
            temple-importer/gemini_location_enhancer.mjs \
            temple-importer/debug_gemini.mjs \
            update-all-coordinates.js \
            coordinate-update-script.js \
            location-search-test.html' \
        --prune-empty --tag-name-filter cat -- --all
fi

echo ""
echo "Step 3: Cleaning up repository..."
echo "----------------------------------"

# Remove backup refs
rm -rf .git/refs/original/

# Expire reflog
git reflog expire --expire=now --all

# Garbage collect
git gc --prune=now --aggressive

echo -e "${GREEN}✓${NC} Repository cleaned"

echo ""
echo "Step 4: Verifying removal..."
echo "----------------------------"

# Check if keys still exist in history
STILL_EXISTS=$(git log --all --full-history --source -- \
    "temple-importer/gemini_batch_enricher.mjs" \
    "temple-importer/gemini_comprehensive_enricher.mjs" \
    "update-all-coordinates.js" 2>/dev/null | wc -l)

if [ "$STILL_EXISTS" -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Files successfully removed from git history"
else
    echo -e "${YELLOW}⚠${NC}  Some files may still exist in history"
    echo "You may need to run the script again or use BFG"
fi

echo ""
echo "===================================================="
echo -e "${GREEN}✓ Git history rewritten!${NC}"
echo "===================================================="
echo ""
echo "📋 NEXT STEPS:"
echo ""
echo "1. ${YELLOW}Verify the cleaned files are now loading from .env:${NC}"
echo "   git log --oneline | head -20"
echo "   git show HEAD:temple-importer/gemini_batch_enricher.mjs | grep 'process.env'"
echo ""
echo "2. ${RED}FORCE PUSH to GitHub (this will overwrite remote history):${NC}"
echo "   git push origin --force --all"
echo "   git push origin --force --tags"
echo ""
echo "3. ${YELLOW}Notify all collaborators:${NC}"
echo "   They must run: git fetch origin && git reset --hard origin/main"
echo ""
echo "4. ${YELLOW}Verify on GitHub:${NC}"
echo "   Visit: https://github.com/srikanthjunk/divyadesam"
echo "   Check that old keys are no longer visible in file history"
echo ""
echo "5. ${GREEN}Monitor API usage:${NC}"
echo "   - Google Cloud Console: Check for unauthorized usage"
echo "   - HERE Maps Dashboard: Check for unusual activity"
echo ""
echo "📁 Full repository backup saved at: ../$BACKUP_DIR"
echo ""
echo -e "${RED}⚠️  REMEMBER: Force push will overwrite GitHub history!${NC}"
echo ""
