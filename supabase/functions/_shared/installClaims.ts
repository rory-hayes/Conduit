import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';

export const claimInstall = async (supabase: SupabaseClient, input: { install_id: string; workspace_id: string; user_id: string }) => {
  const { data: install } = await supabase.from('pending_installs').select('*').eq('id', input.install_id).maybeSingle();
  if (!install) {
    return { error: 'install_not_found' };
  }
  if (install.status !== 'pending') {
    return { error: 'install_not_pending' };
  }
  if (new Date(install.expires_at).getTime() < Date.now()) {
    await supabase.from('pending_installs').update({ status: 'expired' }).eq('id', install.id);
    return { error: 'install_expired' };
  }

  await supabase
    .from('pending_installs')
    .update({ status: 'claimed', workspace_id: input.workspace_id, claimed_by_user_id: input.user_id })
    .eq('id', install.id);

  if (install.connection_id) {
    await supabase
      .from('crm_connections')
      .update({ workspace_id: input.workspace_id, status: 'connected', updated_at: new Date().toISOString() })
      .eq('id', install.connection_id);
  }

  await supabase.from('audit_events').insert({
    workspace_id: input.workspace_id,
    type: 'install_claimed',
    data_json: { install_id: install.id, crm: install.crm, external_account_key: install.external_account_key, claimed_by_user_id: input.user_id }
  });

  return { ok: true, install_id: install.id };
};
