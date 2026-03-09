const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://dldsocponbjthqxhmttj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZHNvY3BvbmJqdGhxeGhtdHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzgzMzgsImV4cCI6MjA4NTAxNDMzOH0.IGxUEd977uIdhWvMzjDM8ygfISB_Frcf_2air8e3aOs';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect() {
    console.log("Fetching visits...");
    const { data, error } = await supabase
        .from('visitas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error fetching visitas:", error);
        return;
    }
    console.log("Visitas:");
    console.log(JSON.stringify(data, null, 2));

    // Check one client for column names
    if (data.length > 0) {
        console.log(`\nFetching client ${data[0].client_code}...`);
        const { data: client, error: clientErr } = await supabase
            .from('data_clients')
            .select('*')
            .limit(1);

        if (clientErr) {
            console.error("Error fetching data_clients:", clientErr);
        } else {
            console.log("Client keys:");
            console.log(Object.keys(client[0]));
        }
    }
}

inspect();
