# Multiple Login/Signup Options Implementation Guide

## Overview
This guide will help you add OAuth providers (Google, GitHub, Microsoft, etc.) to your School Management System alongside the existing email/password authentication.

---

## Table of Contents
1. [Supabase Configuration](#1-supabase-configuration)
2. [OAuth Provider Setup](#2-oauth-provider-setup)
3. [Code Implementation](#3-code-implementation)
4. [Testing](#4-testing)
5. [Important Considerations](#5-important-considerations)

---

## 1. Supabase Configuration

### Step 1.1: Access Supabase Dashboard
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Providers**

### Step 1.2: Configure Redirect URLs
Before enabling providers, set up your redirect URLs:
1. Go to **Authentication** → **URL Configuration**
2. Add these URLs to **Redirect URLs**:
   - `https://localhost:3000/auth/callback` (for development)
   - `https://yourdomain.com/auth/callback` (for production)

---

## 2. OAuth Provider Setup

### Option A: Google OAuth

#### Step 2A.1: Create Google OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Configure OAuth consent screen if prompted:
   - User Type: External
   - App name: School Management System
   - User support email: your email
   - Developer contact: your email
6. Application type: **Web application**
7. Add Authorized redirect URIs:
   ```
   https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback
   ```
   (Find your project ref in Supabase Dashboard → Settings → API)
8. Click **Create** and save your **Client ID** and **Client Secret**

#### Step 2A.2: Enable in Supabase
1. In Supabase Dashboard → **Authentication** → **Providers**
2. Find **Google** and toggle it **ON**
3. Enter your **Client ID** and **Client Secret**
4. Click **Save**

---

### Option B: GitHub OAuth

#### Step 2B.1: Create GitHub OAuth App
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - Application name: School Management System
   - Homepage URL: `https://localhost:3000` (or your domain)
   - Authorization callback URL:
     ```
     https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback
     ```
4. Click **Register application**
5. Generate a new **Client Secret**
6. Save your **Client ID** and **Client Secret**

#### Step 2B.2: Enable in Supabase
1. In Supabase Dashboard → **Authentication** → **Providers**
2. Find **GitHub** and toggle it **ON**
3. Enter your **Client ID** and **Client Secret**
4. Click **Save**

---

### Option C: Microsoft/Azure AD OAuth

#### Step 2C.1: Create Azure AD App
1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Fill in:
   - Name: School Management System
   - Supported account types: Choose based on your needs
   - Redirect URI: Web → `https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback`
5. Click **Register**
6. Note the **Application (client) ID**
7. Go to **Certificates & secrets** → **New client secret**
8. Save the secret value immediately (it won't be shown again)

#### Step 2C.2: Enable in Supabase
1. In Supabase Dashboard → **Authentication** → **Providers**
2. Find **Azure** and toggle it **ON**
3. Enter your **Client ID** and **Client Secret**
4. Enter your **Azure Tenant ID** (from Azure AD overview page)
5. Click **Save**

---

## 3. Code Implementation

### Step 3.1: Create Auth Callback Handler

Create a new file: `app/auth/callback/route.ts`

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Redirect to login page to handle role-based routing
  return NextResponse.redirect(new URL('/login', request.url))
}
```

### Step 3.2: Update Supabase Client Configuration

Update `lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true
    }
})
```

### Step 3.3: Add OAuth Login Functions

Update `lib/api.ts` - Add these functions after the existing auth functions:

```typescript
// OAuth Login Functions
export async function loginWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            }
        }
    })
    if (error) throw error
    return data
}

export async function loginWithGithub() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
            redirectTo: `${window.location.origin}/auth/callback`
        }
    })
    if (error) throw error
    return data
}

export async function loginWithMicrosoft() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            scopes: 'email'
        }
    })
    if (error) throw error
    return data
}
```

### Step 3.4: Update Login Page UI

Update `app/login/page.tsx` - Add OAuth buttons in the form:

```tsx
// Add these imports at the top
import { loginWithGoogle, loginWithGithub, loginWithMicrosoft } from "@/lib/api"
import { Github } from "lucide-react"

// Add this function in the component (after handleSubmit)
const handleOAuthLogin = async (provider: 'google' | 'github' | 'microsoft') => {
  try {
    setLoading(true)
    setError('')
    
    if (provider === 'google') {
      await loginWithGoogle()
    } else if (provider === 'github') {
      await loginWithGithub()
    } else if (provider === 'microsoft') {
      await loginWithMicrosoft()
    }
  } catch (err: any) {
    console.error(err)
    setError(err.message || 'Failed to login with provider')
    setLoading(false)
  }
}

// Add this JSX after the email/password form and before the closing </CardContent>:
{/* Divider */}
<div className="relative my-4">
  <div className="absolute inset-0 flex items-center">
    <span className="w-full border-t" />
  </div>
  <div className="relative flex justify-center text-xs uppercase">
    <span className="bg-background px-2 text-muted-foreground">
      Or continue with
    </span>
  </div>
</div>

{/* OAuth Buttons */}
<div className="grid grid-cols-1 gap-3">
  <Button
    type="button"
    variant="outline"
    onClick={() => handleOAuthLogin('google')}
    disabled={loading}
    className="w-full"
  >
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
    Continue with Google
  </Button>

  <Button
    type="button"
    variant="outline"
    onClick={() => handleOAuthLogin('github')}
    disabled={loading}
    className="w-full"
  >
    <Github className="mr-2 h-4 w-4" />
    Continue with GitHub
  </Button>

  <Button
    type="button"
    variant="outline"
    onClick={() => handleOAuthLogin('microsoft')}
    disabled={loading}
    className="w-full"
  >
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#00a4ef" d="M13 1h10v10H13z" />
      <path fill="#7fba00" d="M1 13h10v10H1z" />
      <path fill="#ffb900" d="M13 13h10v10H13z" />
    </svg>
    Continue with Microsoft
  </Button>
</div>
```

### Step 3.5: Handle OAuth User Profile Creation

Create a database trigger to auto-create profiles for OAuth users.

In your Supabase SQL Editor, run:

```sql
-- Function to handle new OAuth users
CREATE OR REPLACE FUNCTION public.handle_oauth_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if profile already exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    -- Create profile with default role (you may want to set this differently)
    INSERT INTO public.profiles (id, email, role, firstName, lastName)
    VALUES (
      NEW.id,
      NEW.email,
      'STUDENT', -- Default role for OAuth users
      COALESCE(NEW.raw_user_meta_data->>'firstName', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'lastName', '')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new OAuth users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_oauth_user();
```

### Step 3.6: Update Login Page to Handle OAuth Redirects

Update `app/login/page.tsx` - Add this useEffect at the top of the component:

```tsx
import { useEffect } from "react"

// Add this inside the LoginPage component, after the state declarations
useEffect(() => {
  // Check if user just logged in via OAuth
  const checkOAuthUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.user) {
      // Fetch user profile to get role
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      
      if (profile) {
        // Redirect based on role
        switch (profile.role) {
          case "ADMIN":
            router.push("/admin")
            break
          case "TEACHER":
            router.push("/teacher")
            break
          case "STUDENT":
            router.push("/student")
            break
        }
      }
    }
  }
  
  checkOAuthUser()
}, [router])
```

---

## 4. Testing

### Step 4.1: Test OAuth Flow
1. Start your development server: `npm run dev`
2. Navigate to `https://localhost:3000/login`
3. Click on one of the OAuth provider buttons
4. Complete the OAuth flow in the popup/redirect
5. Verify you're redirected back and logged in
6. Check that your profile was created in Supabase

### Step 4.2: Verify Database
1. Go to Supabase Dashboard → **Table Editor** → **profiles**
2. Verify that OAuth users have profiles created automatically
3. Check that the role is set correctly (default: STUDENT)

### Step 4.3: Test Role Assignment
For OAuth users, you'll need to manually assign roles initially:
1. Admin logs in with email/password
2. Goes to User Management
3. Updates the OAuth user's role to TEACHER or ADMIN as needed

---

## 5. Important Considerations

### 5.1: Role Management for OAuth Users
**Issue**: OAuth users are created with a default role (STUDENT).

**Solutions**:
1. **Manual Assignment**: Admin manually assigns roles after OAuth signup
2. **Email Domain-Based**: Auto-assign roles based on email domain
3. **Invitation System**: Only allow OAuth login for pre-registered users

**Recommended**: Use email domain-based assignment. Add this to the trigger:

```sql
-- Enhanced OAuth handler with domain-based roles
CREATE OR REPLACE FUNCTION public.handle_oauth_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    -- Determine role based on email domain
    IF NEW.email LIKE '%@admin.school.edu' THEN
      user_role := 'ADMIN';
    ELSIF NEW.email LIKE '%@teacher.school.edu' THEN
      user_role := 'TEACHER';
    ELSE
      user_role := 'STUDENT';
    END IF;
    
    INSERT INTO public.profiles (id, email, role, firstName, lastName)
    VALUES (
      NEW.id,
      NEW.email,
      user_role,
      COALESCE(NEW.raw_user_meta_data->>'firstName', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'lastName', '')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5.2: Security Considerations
- **Email Verification**: OAuth providers handle email verification
- **RLS Policies**: Your existing RLS policies will work with OAuth users
- **Session Management**: Supabase handles session refresh automatically

### 5.3: Additional Student/Teacher Data
OAuth users won't have student numbers, class assignments, etc. You have two options:

**Option 1**: Require OAuth users to complete their profile after first login
**Option 2**: Create an onboarding flow for new OAuth users

### 5.4: Production Deployment
Before deploying to production:
1. Update OAuth redirect URLs in each provider's console
2. Add production domain to Supabase redirect URLs
3. Test OAuth flow in production environment
4. Consider disabling OAuth for certain roles (e.g., only allow email/password for admins)

---

## 6. Optional Enhancements

### 6.1: Add More Providers
Supabase supports many providers. To add more:
- Apple
- Discord
- Facebook
- Twitter/X
- LinkedIn
- Slack

Follow the same pattern as above for each provider.

### 6.2: Link Multiple Providers
Allow users to link multiple OAuth providers to one account:

```typescript
export async function linkProvider(provider: string) {
  const { data, error } = await supabase.auth.linkIdentity({
    provider: provider as any
  })
  if (error) throw error
  return data
}
```

### 6.3: Show Connected Accounts
Display which providers a user has connected in their profile settings.

---

## 7. Troubleshooting

### Issue: "Invalid redirect URL"
**Solution**: Ensure the redirect URL in your OAuth app matches exactly with Supabase's callback URL

### Issue: OAuth popup blocked
**Solution**: Ensure you're calling the OAuth function directly from a user click event

### Issue: User created but no profile
**Solution**: Check that the database trigger is properly installed and enabled

### Issue: Session not persisting
**Solution**: Verify that cookies are enabled and the auth flow type is set to 'pkce'

---

## Summary

You now have a complete guide to add multiple login options to your School Management System. The implementation:
- ✅ Preserves existing email/password authentication
- ✅ Adds Google, GitHub, and Microsoft OAuth
- ✅ Automatically creates user profiles
- ✅ Maintains role-based access control
- ✅ Works with existing RLS policies

Start with one provider (Google recommended) and test thoroughly before adding others.
