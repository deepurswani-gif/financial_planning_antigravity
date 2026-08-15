import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const assertMasterAdmin = async (supabase: SupabaseClient, userId: string) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('role, admin_permissions')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  
  if (data?.role !== 'admin' || data?.admin_permissions !== null) {
    throw new Error('Master Admin access required');
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { success: false, error: 'Method not allowed' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json(401, { success: false, error: 'Missing authorization header' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return json(500, { success: false, error: 'Missing Supabase environment variables' });
  }

  // Client for verifying the requesting user
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return json(401, { success: false, error: 'Unauthorized user session' });
  }

  // Admin client for executing privileged actions (creating/deleting users)
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    await assertMasterAdmin(userClient, user.id);
  } catch (err) {
    return json(403, {
      success: false,
      error: err instanceof Error ? err.message : 'Forbidden',
    });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json(400, { success: false, error: 'Invalid JSON payload' });
  }

  const action = String(body.action || '');

  if (action === 'create') {
    const { email, password, full_name, permissions } = body;
    if (!email || !password || !Array.isArray(permissions)) {
      return json(400, { success: false, error: 'Missing required fields for creation' });
    }

    // 1. Create auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: String(email),
      password: String(password),
      email_confirm: true,
      user_metadata: { full_name: String(full_name), role: 'admin' },
    });

    if (createError) {
      return json(400, { success: false, error: createError.message });
    }

    if (!newUser.user) {
      return json(500, { success: false, error: 'Failed to create user' });
    }

    // 2. Update user profile to set role and permissions
    const { error: profileError } = await adminClient
      .from('user_profiles')
      .update({
        role: 'admin',
        admin_permissions: permissions,
      })
      .eq('id', newUser.user.id);

    if (profileError) {
      // If profile update fails, we might have a broken user. Try to delete it.
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return json(500, { success: false, error: 'Failed to update user profile permissions: ' + profileError.message });
    }

    return json(200, { success: true, message: 'Sub-admin created successfully' });
  }

  if (action === 'delete') {
    const targetUserId = String(body.userId || '');
    if (!targetUserId) {
      return json(400, { success: false, error: 'Missing userId for deletion' });
    }

    // Don't allow self-deletion via this endpoint
    if (targetUserId === user.id) {
      return json(400, { success: false, error: 'Cannot delete yourself' });
    }

    // Optional: Verify the target user is actually a sub-admin before deleting
    const { data: targetProfile, error: targetError } = await adminClient
      .from('user_profiles')
      .select('role, admin_permissions')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetError || !targetProfile) {
      return json(404, { success: false, error: 'Target user not found' });
    }

    if (targetProfile.role !== 'admin' || targetProfile.admin_permissions === null) {
      return json(400, { success: false, error: 'Can only delete sub-admins' });
    }

    // Delete from auth.users (cascade will delete user_profiles and other references)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);

    if (deleteError) {
      return json(400, { success: false, error: deleteError.message });
    }

    return json(200, { success: true, message: 'Sub-admin deleted successfully' });
  }

  if (action === 'update') {
     const targetUserId = String(body.userId || '');
     const permissions = body.permissions;
     const password = body.password; // optional
     const full_name = body.full_name; // optional
     
     if (!targetUserId || !Array.isArray(permissions)) {
         return json(400, { success: false, error: 'Missing required fields for update' });
     }
     
     if (targetUserId === user.id) {
         return json(400, { success: false, error: 'Cannot update your own account via this endpoint' });
     }
     
     // 1. Update user auth (if password is provided)
     if (password) {
       const { error: authError } = await adminClient.auth.admin.updateUserById(targetUserId, {
         password: String(password)
       });
       if (authError) {
         return json(400, { success: false, error: authError.message });
       }
     }
     
     // 2. Update user profile (permissions, full_name)
     const updateData: any = { admin_permissions: permissions };
     if (full_name) updateData.full_name = full_name;

     const { error: updateError } = await adminClient
        .from('user_profiles')
        .update(updateData)
        .eq('id', targetUserId)
        .eq('role', 'admin'); // Safety check
        
     if (updateError) {
         return json(400, { success: false, error: updateError.message });
     }
     
     return json(200, { success: true, message: 'Sub-admin updated successfully' });
  }

  return json(400, { success: false, error: 'Invalid action' });
});
