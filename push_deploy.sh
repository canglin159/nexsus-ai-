#!/usr/bin/env bash
set -e
cd /home/team/shared/site
git add -A
git commit -m "Phase 4: Analytics, ChatBot, Shipping, SEO, Seller Analytics" || echo "No changes to commit"
git push origin main 2>&1
echo "EXIT CODE: $?"
