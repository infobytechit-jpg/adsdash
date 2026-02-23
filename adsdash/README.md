# AdsDash — Setup Guide

## Your credentials are already in `.env.local` ✅

---

## STEP 1 — Set up the database (5 minutes)

1. Go to **supabase.com** → your project → **SQL Editor** (left sidebar, looks like `</>`)
2. Click **"New query"**
3. Open the file `supabase/migrations/001_schema.sql` from this folder
4. Copy ALL the text in that file and paste it into the SQL editor
5. Click **"Run"** (green button)
6. You should see "Success. No rows returned"

---

## STEP 2 — Make yourself an admin (2 minutes)

1. Go to your app's login page (after deploy) and create an account with YOUR email
2. Go back to Supabase → **SQL Editor** → New query
3. Run this (replace with your actual email):

```sql
update public.profiles set role = 'admin' where email = 'YOUR-EMAIL-HERE';
```

4. Click Run → you are now admin

---

## STEP 3 — Upload to GitHub (5 minutes)

1. Go to **github.com** → click **"New repository"**
2. Name it `adsdash`, set it to **Private**, click Create
3. Open **Terminal** (Mac) or **Command Prompt** (Windows) in this folder
4. Run these commands one by one:

```bash
git init
git add .
git commit -m "Initial AdsDash setup"
git branch -M main
git remote add origin https://github.com/YOUR-GITHUB-USERNAME/adsdash.git
git push -u origin main
```

---

## STEP 4 — Deploy on Vercel (5 minutes)

1. Go to **vercel.com** → **"Add New Project"**
2. Click **"Import"** next to your `adsdash` GitHub repository
3. In **"Environment Variables"**, add these one by one (copy from your `.env.local`):

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fipzxxkvrnelkkkdrwzt.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(your anon key)* |
| `SUPABASE_SERVICE_ROLE_KEY` | *(your service role key)* |
| `RESEND_API_KEY` | *(from resend.com → API Keys)* |
| `RESEND_FROM_EMAIL` | *(your sender email)* |
| `NEXT_PUBLIC_APP_URL` | *(your vercel URL, e.g. https://adsdash.vercel.app)* |
| `NEXTAUTH_SECRET` | *(any long random string)* |

4. Click **"Deploy"** — it will build and go live automatically!

---

## STEP 5 — Get your Resend API key (3 minutes)

1. Go to **resend.com** → Sign in → **API Keys** → **Create API Key**
2. Copy the key (starts with `re_`)
3. Add it to Vercel environment variables as `RESEND_API_KEY`
4. Redeploy from Vercel dashboard

---

## Adding Clients

Once live, log in as admin → **Admin Panel** → **Add Client**
- Enter their name, email, and a temporary password
- They'll use that to log in and see ONLY their own data

## Connecting Ad Accounts

Admin → **Ad Accounts** → **Connect Account**
- Select the client
- Enter their Google Ads Customer ID or Meta Ad Account ID
- Enter the OAuth tokens (see below for how to get these)

---

## Getting API Tokens (Google & Meta)

**Google Ads:**
- Go to developers.google.com/google-ads/api
- Apply for a Developer Token (free, takes 1-2 days to approve)
- Create OAuth2 credentials in Google Cloud Console
- Use the OAuth playground to generate access + refresh tokens

**Meta Ads:**
- Go to developers.facebook.com
- Create an App → Marketing API
- Generate a long-lived access token for each ad account

> 💡 Reply in the chat and I'll walk you through getting these tokens step by step!
