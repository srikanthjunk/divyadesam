import 'dotenv/config';
import url from 'url';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function checkOrphanedRecords() {
  console.log('🔍 Checking for orphaned records...');
  
  const checks = [
    {
      name: 'Temple-Traditions without temples',
      query: `
        SELECT COUNT(*) as count 
        FROM temple_traditions tt 
        LEFT JOIN temples t ON tt.temple_id = t.id 
        WHERE t.id IS NULL
      `
    },
    {
      name: 'Temple-Deities without temples',
      query: `
        SELECT COUNT(*) as count 
        FROM temple_deities td 
        LEFT JOIN temples t ON td.temple_id = t.id 
        WHERE t.id IS NULL
      `
    },
    {
      name: 'Sources without temples',
      query: `
        SELECT COUNT(*) as count 
        FROM sources s 
        LEFT JOIN temples t ON s.temple_id = t.id 
        WHERE t.id IS NULL
      `
    },
    {
      name: 'Temple-Trails without temples',
      query: `
        SELECT COUNT(*) as count 
        FROM temple_trails tt 
        LEFT JOIN temples t ON tt.temple_id = t.id 
        WHERE t.id IS NULL
      `
    },
    {
      name: 'Temple-Trails without trails',
      query: `
        SELECT COUNT(*) as count 
        FROM temple_trails tt 
        LEFT JOIN trails tr ON tt.trail_id = tr.id 
        WHERE tr.id IS NULL
      `
    }
  ];
  
  let issues = 0;
  
  for (const check of checks) {
    try {
      const { data, error } = await sb.rpc('exec_sql', { sql: check.query });
      if (error) throw error;
      
      const count = data[0]?.count || 0;
      if (count > 0) {
        console.log(`⚠️  ${check.name}: ${count} orphaned records`);
        issues++;
      } else {
        console.log(`✅ ${check.name}: No issues`);
      }
    } catch (error) {
      console.log(`❌ Error checking ${check.name}: ${error.message}`);
      issues++;
    }
  }
  
  return issues;
}

async function checkDataConsistency() {
  console.log('\n🔍 Checking data consistency...');
  
  const checks = [
    {
      name: 'Temples without coordinates',
      query: `SELECT COUNT(*) as count FROM temples WHERE lat IS NULL OR lng IS NULL`
    },
    {
      name: 'Temples without state',
      query: `SELECT COUNT(*) as count FROM temples WHERE state IS NULL OR state = ''`
    },
    {
      name: 'Duplicate temple slugs',
      query: `
        SELECT slug, COUNT(*) as count 
        FROM temples 
        GROUP BY slug 
        HAVING COUNT(*) > 1
      `
    },
    {
      name: 'Trails with incorrect temple count',
      query: `
        SELECT tr.slug, tr.total_temples, COUNT(tt.temple_id) as actual_count
        FROM trails tr
        LEFT JOIN temple_trails tt ON tr.id = tt.trail_id
        GROUP BY tr.id, tr.slug, tr.total_temples
        HAVING tr.total_temples != COUNT(tt.temple_id)
      `
    },
    {
      name: 'Temple-Trail position gaps',
      query: `
        WITH trail_positions AS (
          SELECT trail_id, array_agg(position ORDER BY position) as positions
          FROM temple_trails
          GROUP BY trail_id
        )
        SELECT COUNT(*) as count
        FROM trail_positions
        WHERE positions != (SELECT array_agg(s) FROM generate_series(1, array_length(positions, 1)) s)
      `
    }
  ];
  
  let issues = 0;
  
  for (const check of checks) {
    try {
      const { data, error } = await sb.rpc('exec_sql', { sql: check.query });
      if (error) throw error;
      
      if (check.name.includes('Duplicate') || check.name.includes('incorrect') || check.name.includes('gaps')) {
        const count = data?.length || 0;
        if (count > 0) {
          console.log(`⚠️  ${check.name}: ${count} issues`);
          if (count <= 5) console.log('    Details:', data);
          issues++;
        } else {
          console.log(`✅ ${check.name}: No issues`);
        }
      } else {
        const count = data[0]?.count || 0;
        if (count > 0) {
          console.log(`ℹ️  ${check.name}: ${count} records (may be normal)`);
        } else {
          console.log(`✅ ${check.name}: Complete`);
        }
      }
    } catch (error) {
      console.log(`❌ Error checking ${check.name}: ${error.message}`);
      issues++;
    }
  }
  
  return issues;
}

async function generateSummaryReport() {
  console.log('\n📊 Generating summary report...');
  
  try {
    const queries = [
      {
        label: 'Total temples',
        sql: 'SELECT COUNT(*) as count FROM temples'
      },
      {
        label: 'Divya Desam temples',
        sql: `
          SELECT COUNT(*) as count 
          FROM temples t
          JOIN temple_traditions tt ON t.id = tt.temple_id
          JOIN traditions tr ON tt.tradition_id = tr.id
          WHERE tr.code = 'divya-desam'
        `
      },
      {
        label: 'Abhimana Sthalam temples',
        sql: `
          SELECT COUNT(*) as count 
          FROM temples t
          JOIN temple_traditions tt ON t.id = tt.temple_id
          JOIN traditions tr ON tt.tradition_id = tr.id
          WHERE tr.code = 'abhimana-sthalam'
        `
      },
      {
        label: 'Paadal Petra Sthalams',
        sql: 'SELECT COUNT(*) as count FROM temples WHERE paadal_petra = true'
      },
      {
        label: 'Temples with coordinates',
        sql: 'SELECT COUNT(*) as count FROM temples WHERE lat IS NOT NULL AND lng IS NOT NULL'
      },
      {
        label: 'Temples with Wikidata QIDs',
        sql: 'SELECT COUNT(*) as count FROM temples WHERE wikidata_qid IS NOT NULL'
      },
      {
        label: 'Temples with Tamil names',
        sql: 'SELECT COUNT(*) as count FROM temples WHERE name_ta IS NOT NULL'
      },
      {
        label: 'Active trails',
        sql: 'SELECT COUNT(*) as count FROM trails'
      },
      {
        label: 'Temple-trail relationships',
        sql: 'SELECT COUNT(*) as count FROM temple_trails'
      },
      {
        label: 'Active subscribers',
        sql: 'SELECT COUNT(*) as count FROM subscribers WHERE is_active = true'
      },
      {
        label: 'Alert events',
        sql: 'SELECT COUNT(*) as count FROM alert_events'
      }
    ];
    
    const report = {};
    
    for (const { label, sql } of queries) {
      try {
        const { data, error } = await sb.rpc('exec_sql', { sql });
        if (error) throw error;
        report[label] = data[0]?.count || 0;
        console.log(`📈 ${label}: ${report[label]}`);
      } catch (error) {
        console.log(`❌ ${label}: Error - ${error.message}`);
        report[label] = 'ERROR';
      }
    }
    
    return report;
  } catch (error) {
    console.log(`❌ Report generation failed: ${error.message}`);
    return {};
  }
}

async function main() {
  console.log('🔬 Starting database integrity verification...\n');
  
  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    console.log('❌ Cannot proceed - database connection failed');
    return;
  }
  
  const tablesOk = await testTableStructure();
  const orphanIssues = await checkOrphanedRecords();
  const consistencyIssues = await checkDataConsistency();
  
  await generateSummaryReport();
  
  console.log('\n🎯 Integrity Verification Summary:');
  console.log(`✅ Database connection: ${dbConnected ? 'OK' : 'FAILED'}`);
  console.log(`✅ Table structure: ${tablesOk ? 'OK' : 'ISSUES'}`);
  console.log(`✅ Orphaned records: ${orphanIssues === 0 ? 'NONE' : `${orphanIssues} ISSUES`}`);
  console.log(`✅ Data consistency: ${consistencyIssues === 0 ? 'OK' : `${consistencyIssues} ISSUES`}`);
  
  if (dbConnected && tablesOk && orphanIssues === 0 && consistencyIssues === 0) {
    console.log('\n🎉 Database integrity verification PASSED!');
  } else {
    console.log('\n⚠️  Database integrity verification found issues - review logs above');
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}