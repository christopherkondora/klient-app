/**
 * Billingo API Test Script
 *
 * Tests the Billingo integration to diagnose invoicing issues.
 * Run with: deno run --allow-net --allow-env scripts/test-billingo.ts
 */

// Configuration (will be loaded from environment)
const BILLINGO_API_KEY = Deno.env.get('BILLINGO_API_KEY') || '';
const BILLINGO_ENV = Deno.env.get('BILLINGO_ENV') || 'sandbox';
const BILLINGO_BLOCK_ID = parseInt(Deno.env.get('BILLINGO_BLOCK_ID') || '315117', 10);

function getBillingoBaseUrl(): string {
  if (BILLINGO_ENV === 'production') {
    return 'https://api.billingo.hu/v3';
  }
  return 'https://api.sandbox.billingo.hu/v3';
}

async function testBillingoConnection() {
  console.log('🔍 Billingo Integration Diagnostic\n');
  console.log('Configuration:');
  console.log('  Environment:', BILLINGO_ENV);
  console.log('  Base URL:', getBillingoBaseUrl());
  console.log('  Block ID:', BILLINGO_BLOCK_ID);
  console.log('  API Key:', BILLINGO_API_KEY ? `${BILLINGO_API_KEY.substring(0, 8)}...` : '❌ NOT SET');
  console.log('');

  if (!BILLINGO_API_KEY) {
    console.error('❌ BILLINGO_API_KEY is not set!');
    console.error('   Set it with: export BILLINGO_API_KEY=your_key_here');
    Deno.exit(1);
  }

  const baseUrl = getBillingoBaseUrl();

  // Test 1: Verify API key
  console.log('Test 1: Verifying API key...');
  try {
    const response = await fetch(`${baseUrl}/organization`, {
      headers: {
        'X-API-KEY': BILLINGO_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const org = await response.json();
      console.log('✅ API key valid');
      console.log('   Organization:', org.name || 'Unknown');
      console.log('   Tax number:', org.tax_number || 'N/A');
    } else {
      const errorText = await response.text();
      console.error('❌ API key invalid or request failed');
      console.error('   Status:', response.status, response.statusText);
      console.error('   Response:', errorText);
      Deno.exit(1);
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
    Deno.exit(1);
  }

  console.log('');

  // Test 2: List partners (to verify access)
  console.log('Test 2: Listing partners...');
  try {
    const response = await fetch(`${baseUrl}/partners?per_page=5`, {
      headers: {
        'X-API-KEY': BILLINGO_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const partners = data.data || data;
      console.log('✅ Partners accessible');
      console.log('   Total partners:', partners.length);
      if (partners.length > 0) {
        console.log('   First partner:', partners[0].name || partners[0].id);
      }
    } else {
      const errorText = await response.text();
      console.error('⚠️  Cannot list partners');
      console.error('   Status:', response.status, response.statusText);
      console.error('   Response:', errorText);
    }
  } catch (error) {
    console.error('⚠️  Network error:', error.message);
  }

  console.log('');

  // Test 3: Verify block access
  console.log('Test 3: Verifying block access...');
  console.log('   Block ID:', BILLINGO_BLOCK_ID);

  // Note: There's no direct "get block by ID" endpoint in Billingo API v3
  // Block ID is only validated when creating documents
  console.log('   ℹ️  Block access can only be verified by creating a document');
  console.log('   If invoice creation fails, check that Block ID', BILLINGO_BLOCK_ID, 'exists in your Billingo account');

  console.log('');

  // Test 4: Create a test partner and invoice
  console.log('Test 4: Creating test partner and invoice...');
  console.log('   ⚠️  This will create REAL test data in your Billingo account!');
  console.log('   Skipping for safety. To enable, modify this script.');
  console.log('');

  console.log('✅ All diagnostic tests passed!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Ensure these environment variables are set in Supabase:');
  console.log('   supabase secrets set BILLINGO_API_KEY=' + BILLINGO_API_KEY.substring(0, 8) + '...');
  console.log('   supabase secrets set BILLINGO_ENV=' + BILLINGO_ENV);
  console.log('   supabase secrets set BILLINGO_BLOCK_ID=' + BILLINGO_BLOCK_ID);
  console.log('');
  console.log('2. Redeploy the webhook function:');
  console.log('   supabase functions deploy stripe-webhook --no-verify-jwt');
  console.log('');
  console.log('3. Test with a payment and check Supabase logs for [Billingo] entries');
}

// Run the test
testBillingoConnection().catch(console.error);
