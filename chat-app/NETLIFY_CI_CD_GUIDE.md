# GitHub Actions CI/CD Pipeline to Netlify Guide

This guide explains how to set up an automated Continuous Integration and Continuous Deployment (CI/CD) pipeline using **GitHub Actions** to deploy your React Vite chat application to **Netlify** every time you push code or open a pull request.

---

## 📋 Table of Contents
1. [The CI/CD Flow Scenario](#1-the-cicd-flow-scenario)
2. [Step 1: Retrieve Netlify Credentials](#step-1-retrieve-netlify-credentials)
3. [Step 2: Set Up GitHub Repository Secrets](#step-2-set-up-github-repository-secrets)
4. [Step 3: Handle Vite Environment Variables](#step-3-handle-vite-environment-variables)
5. [Step 4: Create the GitHub Actions Workflow File](#step-4-create-the-github-actions-workflow-file)
6. [💡 Alternative: Direct Netlify Git Integration](#-alternative-direct-netlify-git-integration)

---

## 1. The CI/CD Flow Scenario

When you set up GitHub Actions, the deployment workflow operates as follows:

```
[Local Code Push] ---> (GitHub Repository)
                             |
                             v (Triggers Workflow)
                   [GitHub Actions Runner]
                             |
         +-------------------+-------------------+
         | Check out repository code             |
         | Set up Node.js & dependencies          |
         | Run ESLint verification               |
         | Build Production Assets (Vite dist)   |
         | Deploy to Netlify (via Netlify CLI)   |
         +-------------------+-------------------+
                             |
         +-------------------+-------------------+
         | (If PR) -> Deploy Preview URL         |
         | (If push to main) -> Deploy Prod URL |
         +---------------------------------------+
```

1. **Trigger:** You push code to the `main` branch or open a Pull Request (PR) against `main`.
2. **Build Server:** GitHub spins up a clean Ubuntu virtual machine (runner).
3. **Setup:** The runner checks out your code, installs Node.js, and installs your project dependencies (`npm ci`).
4. **Validation:** The runner runs ESLint (`npm run lint`) to make sure there are no code quality or syntax issues.
5. **Build:** The runner compiles the production bundle using `npm run build`, which bundles your React code and CSS into the `dist/` directory. Your environment variables (Supabase, Firebase keys, etc.) are injected during this step.
6. **Deploy:** The runner uses the official Netlify CLI (`npx netlify-cli`) to deploy the built `dist/` directory:
   - **For pushes to `main`:** Deploys directly to production.
   - **For PRs:** Deploys a preview draft so you can test the changes before merging.

---

## Step 1: Retrieve Netlify Credentials

To let GitHub Actions talk to Netlify securely, you need two items:

### A. Netlify Personal Access Token
This token authorizes GitHub Actions to perform actions on your Netlify account.
1. Go to your [Netlify User Settings (Applications)](https://app.netlify.com/user/applications/personal-access-tokens).
2. Click **New access token**.
3. Enter a description (e.g., `GitHub Actions CI/CD`) and click **Generate token**.
4. **Copy the token immediately** (you won't be able to see it again).

### B. Netlify Site ID (API ID)
This ID tells GitHub Actions *which* specific Netlify site to deploy to.
1. Go to your [Netlify Dashboard](https://app.netlify.com/).
2. Select your chat application site.
3. Go to **Site Configuration** > **General** > **Site details**.
4. Find the **API ID** (it looks like a UUID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
5. Copy this ID.

---

## Step 2: Set Up GitHub Repository Secrets

Never hardcode passwords or API keys in your repository. Instead, store them in GitHub Secrets:

1. Open your repository on GitHub.
2. Go to **Settings** (tab at the top) > **Secrets and variables** > **Actions** (in the left sidebar).
3. Under the **Repository secrets** section, click **New repository secret**.
4. Add the following secrets:
   - **Name:** `NETLIFY_AUTH_TOKEN`
     - **Value:** *Paste the Personal Access Token from Step 1-A.*
   - **Name:** `NETLIFY_SITE_ID`
     - **Value:** *Paste the Site ID from Step 1-B.*

---

## Step 3: Handle Vite Environment Variables

Vite embeds environment variables starting with `VITE_` into your compiled JavaScript code *during build time*. Because of this, the GitHub Actions build machine needs access to these values when running `npm run build`.

You have two choices to manage these:

### Option A: Store them in GitHub Secrets (Recommended for security)
Add each environment variable from your `.env` file as a GitHub Secret (using the same steps as above):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_VAPID_PUBLIC_KEY`
- `VITE_SOCKET_URL` (if configured)

These secrets are then injected into the build step in your GitHub Actions workflow file.

### Option B: Keep them in Netlify's Environment Variables (Simple)
If you prefer not to manage env vars in GitHub, you can define them in the Netlify Dashboard (**Site Configuration** > **Environment variables**). However, for this to work, you must build the project on Netlify instead of GitHub Actions (see [Alternative: Direct Netlify Git Integration](#-alternative-direct-netlify-git-integration) below).

---

## Step 4: Create the GitHub Actions Workflow File

A workflow file has been created for you at:
📂 [`.github/workflows/deploy.yml`](file:///c:/Users/ghosh/Downloads/Projects/React-js-Javascript/chat-app/.github/workflows/deploy.yml)

Here is the exact structure of that file:

```yaml
name: Deploy to Netlify

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run Lint
        run: npm run lint

      - name: Build Web App
        run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_VAPID_PUBLIC_KEY: ${{ secrets.VITE_VAPID_PUBLIC_KEY }}
          VITE_SOCKET_URL: ${{ secrets.VITE_SOCKET_URL }}

      - name: Deploy to Netlify
        run: |
          if [ "${{ github.event_name }}" == "pull_request" ]; then
            echo "Deploying Preview..."
            npx netlify-cli deploy --dir=dist --site=${{ secrets.NETLIFY_SITE_ID }} --auth=${{ secrets.NETLIFY_AUTH_TOKEN }}
          else
            echo "Deploying Production..."
            npx netlify-cli deploy --prod --dir=dist --site=${{ secrets.NETLIFY_SITE_ID }} --auth=${{ secrets.NETLIFY_AUTH_TOKEN }}
          fi
```

### How to use it:
1. Save this code to `.github/workflows/deploy.yml`.
2. Commit and push the folder `.github/` to your GitHub repository.
3. Every time you push or open a PR, check the **Actions** tab on your GitHub repository to monitor the deployment!

---

## 💡 Alternative: Direct Netlify Git Integration

If you want a simpler setup without writing custom GitHub Actions, Netlify offers a built-in direct integration:

1. Log in to [Netlify](https://app.netlify.com/).
2. Select **Add new site** > **Import an existing project**.
3. Connect your GitHub account and select your repository.
4. Set the build configurations:
   - **Branch to deploy:** `main`
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Go to **Site Configuration** > **Environment variables** to input your `VITE_` variables.
6. Click **Deploy**.

**Which one should you choose?**
* **Choose GitHub Actions (Option B)** if you want to run lint checks, run tests (e.g., Jest/Cypress), or run custom scripts before deploying. It prevents broken code from ever reaching Netlify.
* **Choose Netlify Integration (Alternative)** if you want the easiest configuration and want Netlify to manage all aspects of building, environment variables, and branch previews automatically.
