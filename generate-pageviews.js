const fetch = require('node-fetch');  
const fs = require('fs');  
const path = require('path');  

// Start with basic pages  
const pages = ['/'];  

// Add all posts by reading from _posts directory  
const postsDir = path.join(__dirname, '_posts');  
const postFiles = fs.readdirSync(postsDir);  

postFiles.forEach(file => {  
  if (file.endsWith('.md')) {  
    // Extract title from filename (remove date and extension)  
    const title = file.replace(/^\d{4}-\d{2}-\d{2}-(.+)\.md$/, '$1');  
    pages.push(`/posts/${title}`);  
  }  
});  

console.log('Pages to track:', pages);  

// GoatCounter API token  
const token = '1dp6nfrumn0o512nikay1kel2jqepcyp5z1sh4kg5mtbm9joet';  

// Helper function for sleeping  
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));  

// Function to fetch a single page with retries  
async function fetchPageWithRetry(page, maxRetries = 3) {  
  let retries = 0;  
  
  while (retries < maxRetries) {  
    try {  
      const response = await fetch('https://whatisthecode.goatcounter.com/api/v0/export', {  
        method: 'POST',  
        headers: {  
          'Authorization': `Bearer ${token}`,  
          'Content-Type': 'application/json'  
        },  
        body: JSON.stringify({  
          path: page,  
          filter: ["event:hit"]  
        })  
      });  
      
      // Check if rate limited  
      if (response.status === 429) {  
        const retryAfter = parseInt(response.headers.get('retry-after') || '5');  
        console.log(`Rate limited for ${page}, waiting ${retryAfter} seconds...`);  
        await sleep(retryAfter * 1000);  
        retries++;  
        continue;  
      }  
      
      // Check for other errors  
      if (!response.ok) {  
        throw new Error(`API returned status ${response.status}: ${await response.text()}`);  
      }  
      
      const data = await response.json();  
      return data.length || 0;  
      
    } catch (error) {  
      console.error(`Error fetching views for ${page} (attempt ${retries+1}/${maxRetries}):`, error.message);  
      
      retries++;  
      // Exponential backoff: wait longer between each retry  
      await sleep(1000 * Math.pow(2, retries));   
      
      // If we've exhausted retries, return 0  
      if (retries >= maxRetries) {  
        console.error(`Max retries reached for ${page}, returning 0`);  
        return 0;  
      }  
    }  
  }  
  
  return 0;  
}  

async function fetchPageViews() {  
  const counts = {};  
  
  // Process pages sequentially with significant delays  
  for (const page of pages) {  
    try {  
      console.log(`Fetching page views for ${page}...`);  
      counts[page] = await fetchPageWithRetry(page);  
      
      // Sleep for 2 seconds between requests to avoid rate limits  
      await sleep(2000);  
      
    } catch (error) {  
      console.error(`Error fetching views for ${page}:`, error);  
      counts[page] = 0;  
    }  
  }  
  
  return counts;  
}  

// Run the function and save the results  
fetchPageViews()  
  .then(counts => {  
    // Create assets directory if it doesn't exist  
    const assetsDir = path.join(__dirname, 'assets');  
    if (!fs.existsSync(assetsDir)) {  
      fs.mkdirSync(assetsDir, { recursive: true });  
    }  
    
    fs.writeFileSync(  
      path.join(assetsDir, 'pageviews.json'),  
      JSON.stringify(counts)  
    );  
    console.log('Page view counts saved to pageviews.json');  
  })  
  .catch(error => {  
    console.error('Failed to generate page view counts:', error);  
  });