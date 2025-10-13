# 🚀 Push Instructions - Security Fix Complete

## ✅ What's Been Done:

1. ✅ **Removed 3 files with exposed API keys:**
   - `update-all-coordinates.js` (HERE Maps key)
   - `coordinate-update-script.js` (HERE Maps key)
   - `location-search-test.html` (OpenRoute key)

2. ✅ **Created documentation:**
   - `DEPRECATED_SCRIPTS.md` - Explains what was removed
   - `SECURITY_ACTION_PLAN.md` - Security remediation guide
   - `divyadesam/temple-importer/.env` - Template for development keys

3. ✅ **Committed changes locally:**
   - Commit: `3c17928` "Security: Remove scripts with exposed API keys"

---

## 🔴 CRITICAL: You Must Push to GitHub NOW

The changes are **committed locally** but **NOT on GitHub yet**. The exposed keys are still visible on GitHub until you push!

### **Push Command:**

```bash
cd /Users/srikpart/Downloads/github/divyadesam

git push origin main
```

### **If SSH Key Fails:**

You'll need to either:

**Option 1: Fix SSH Key**
```bash
# Test SSH connection
ssh -T git@github.com

# If it fails, generate new SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Add to SSH agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Copy public key and add to GitHub
cat ~/.ssh/id_ed25519.pub
# Go to GitHub.com → Settings → SSH Keys → Add New
```

**Option 2: Use HTTPS Instead**
```bash
# Change remote to HTTPS
git remote set-url origin https://github.com/srikanthjunk/divyadesam.git

# Push (will prompt for GitHub username/password or token)
git push origin main
```

---

## ⏱️ Timeline:

- ✅ Security issue identified
- ✅ Files removed locally
- ✅ Changes committed
- ⚠️ **PENDING: Push to GitHub** ← YOU ARE HERE
- ⏳ Verify on GitHub
- ⏳ Confirm keys are gone

---

## 📋 After Pushing, Verify:

1. Go to: https://github.com/srikanthjunk/divyadesam
2. Check that these files are GONE:
   - `update-all-coordinates.js`
   - `coordinate-update-script.js`
   - `location-search-test.html`
3. Click "commits" and verify the security commit is there
4. Check file history - old keys should still be visible (we'll fix that next)

---

## 🔄 Next Step: Remove Keys from Git History

**IMPORTANT:** Even after pushing, the old keys are still in git history. To remove them completely:

```bash
# This removes the files from ALL past commits
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch update-all-coordinates.js coordinate-update-script.js location-search-test.html" \
  --prune-empty --tag-name-filter cat -- --all

# Clean up
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (overwrites history on GitHub)
git push origin --force --all
```

---

## ✅ Summary:

**Current Status:**
- HERE Maps API key: Still on GitHub (in current files)
- OpenRoute API key: Still on GitHub (in current files)

**After you push:**
- HERE Maps API key: Removed from current files, but in history
- OpenRoute API key: Removed from current files, but in history

**After history rewrite:**
- HERE Maps API key: Completely gone
- OpenRoute API key: Completely gone

---

**Push now to secure the current version!**
