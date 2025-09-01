import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function unsubscribeByToken(token) {
  try {
    // Find subscriber by token
    const { data: subscriber, error: findError } = await sb
      .from('subscribers')
      .select('id, email, is_active')
      .eq('unsubscribe_token', token)
      .single();
      
    if (findError || !subscriber) {
      return { success: false, reason: 'Invalid unsubscribe token' };
    }
    
    if (!subscriber.is_active) {
      return { success: true, reason: 'Already unsubscribed', email: subscriber.email };
    }
    
    // Update subscriber to inactive
    const { error: updateError } = await sb
      .from('subscribers')
      .update({
        is_active: false,
        unsubscribed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('unsubscribe_token', token);
      
    if (updateError) throw updateError;
    
    console.log(`✅ Unsubscribed: ${subscriber.email}`);
    return { success: true, email: subscriber.email };
    
  } catch (error) {
    console.log(`❌ Unsubscribe error: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

async function addSubscriber(email) {
  try {
    // Check if already exists
    const { data: existing } = await sb
      .from('subscribers')
      .select('id, is_active, unsubscribe_token')
      .eq('email', email)
      .maybeSingle();
      
    if (existing) {
      if (existing.is_active) {
        return { success: true, reason: 'Already subscribed', token: existing.unsubscribe_token };
      } else {
        // Reactivate
        const { error } = await sb
          .from('subscribers')
          .update({
            is_active: true,
            unsubscribed_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
          
        if (error) throw error;
        return { success: true, reason: 'Resubscribed', token: existing.unsubscribe_token };
      }
    }
    
    // Create new subscriber
    const { data: newSub, error } = await sb
      .from('subscribers')
      .insert({ email })
      .select('unsubscribe_token')
      .single();
      
    if (error) throw error;
    
    console.log(`✅ New subscriber: ${email}`);
    return { success: true, token: newSub.unsubscribe_token };
    
  } catch (error) {
    console.log(`❌ Subscribe error: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

async function getSubscriberStats() {
  const { data, error } = await sb
    .from('subscribers')
    .select('is_active')
    .select('*', { count: 'exact' });
    
  if (error) throw error;
  
  const active = data.filter(s => s.is_active).length;
  const inactive = data.filter(s => !s.is_active).length;
  
  return { total: data.length, active, inactive };
}

// Function to test unsubscribe functionality
async function testUnsubscribe() {
  console.log('🧪 Testing unsubscribe functionality...');
  
  // Add a test subscriber
  const testEmail = 'test@example.com';
  const addResult = await addSubscriber(testEmail);
  
  if (!addResult.success) {
    console.log('❌ Failed to add test subscriber');
    return;
  }
  
  console.log(`✅ Added test subscriber with token: ${addResult.token}`);
  
  // Test unsubscribe
  const unsubResult = await unsubscribeByToken(addResult.token);
  
  if (unsubResult.success) {
    console.log(`✅ Successfully unsubscribed: ${unsubResult.email}`);
  } else {
    console.log(`❌ Unsubscribe failed: ${unsubResult.reason}`);
  }
  
  // Clean up test subscriber
  await sb.from('subscribers').delete().eq('email', testEmail);
  console.log('🧹 Cleaned up test subscriber');
}

async function main() {
  console.log('📧 Setting up unsubscribe system...');
  
  await createSubscribersTable();
  
  const stats = await getSubscriberStats();
  console.log(`📊 Subscriber stats: ${stats.active} active, ${stats.inactive} inactive, ${stats.total} total`);
  
  await testUnsubscribe();
  
  console.log('✅ Unsubscribe system setup completed!');
  console.log('');
  console.log('📝 Usage:');
  console.log('  Add subscriber: await addSubscriber("user@example.com")');
  console.log('  Unsubscribe: await unsubscribeByToken("uuid-token")');
  console.log('  Get stats: await getSubscriberStats()');
}

export { unsubscribeByToken, addSubscriber, getSubscriberStats };

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}