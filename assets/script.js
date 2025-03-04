document.addEventListener('DOMContentLoaded', init);

function init() {
    const form = document.getElementById('analysis-form');
    form.addEventListener('submit', handleSubmit);
    initializeDragAndDrop();
    setupApiKeyToggle();
    setupAiProviderSelection();
}

function initializeDragAndDrop() {
    setupDropZone('dropzone', 'dropzone-overlay', 'resume');
    setupJobUrlFetching();
}

function setupJobUrlFetching() {
    const fetchBtn = document.getElementById('fetchJobBtn');
    const jobUrl = document.getElementById('jobUrl');
    const jobDescription = document.getElementById('jobDescription');
    const jobDisplay = document.getElementById('jobDisplay');
    const jobTitle = document.getElementById('jobTitle');
    const jobCompany = document.getElementById('jobCompany');
    const loadingOverlay = document.getElementById('jobLoadingOverlay');
    const removeJobBtn = document.getElementById('removeJob');

    fetchBtn.addEventListener('click', async () => {
        const url = jobUrl.value.trim();
        if (!url) {
            displayError('Please enter a job posting URL');
            return;
        }

        try {
            // Show loading overlay
            loadingOverlay.classList.remove('hidden');
            jobDisplay.classList.add('hidden');

            const response = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(url));
            if (!response.ok) throw new Error('Failed to fetch job description');
            
            const data = await response.json();
            if (!data.contents) throw new Error('No content found');

            // Create a temporary div to parse the HTML content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = data.contents;

            // Remove scripts and styles
            tempDiv.querySelectorAll('script, style').forEach(el => el.remove());

            // Try to extract job title and company
            let title = '';
            let company = '';

            // Common selectors for job titles and company names
            const titleSelectors = ['h1', '[data-testid="job-title"]', '.job-title', '.position-title'];
            const companySelectors = ['.company-name', '[data-testid="company-name"]', '.organization'];

            // Try to find job title
            for (const selector of titleSelectors) {
                const element = tempDiv.querySelector(selector);
                if (element) {
                    title = element.textContent.trim();
                    break;
                }
            }

            // Try to find company name
            for (const selector of companySelectors) {
                const element = tempDiv.querySelector(selector);
                if (element) {
                    company = element.textContent.trim();
                    break;
                }
            }

            // Get the text content
            let jobText = tempDiv.textContent || tempDiv.innerText;
            // Clean up the text
            jobText = jobText
                .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
                .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
                .trim();

            // Update display
            jobTitle.textContent = title || 'Job Position';
            jobCompany.textContent = company || new URL(url).hostname;
            jobDescription.value = jobText;
            
            // Show job display
            jobDisplay.classList.remove('hidden');
            jobUrl.value = '';
        } catch (error) {
            displayError('Error fetching job description: ' + error.message);
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    });

    // Handle remove job button
    removeJobBtn.addEventListener('click', () => {
        jobDisplay.classList.add('hidden');
        jobDescription.value = '';
        jobUrl.value = '';
    });
}

function setupDropZone(dropzoneId, overlayId, textareaId) {
    const dropzone = document.getElementById(dropzoneId);
    const overlay = document.getElementById(overlayId);
    const textarea = document.getElementById(textareaId);

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Handle drag enter and leave
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            overlay.style.opacity = '1';
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            overlay.style.opacity = '0';
        }, false);
    });

    // Handle dropped files
    dropzone.addEventListener('drop', async (e) => {
        const file = e.dataTransfer.files[0];
        if (file) {
            try {
                // Update file display
                const fileDisplay = document.getElementById('fileDisplay');
                const fileName = document.getElementById('fileName');
                fileName.textContent = file.name;
                fileDisplay.classList.remove('hidden');

                // Read and set content
                const content = await readFileContent(file);
                textarea.value = content;

                // Hide dropzone
                dropzone.classList.add('hidden');
            } catch (error) {
                displayError('Error reading file: ' + error.message);
            }
        }
    }, false);

    // Handle remove file button
    document.getElementById('removeFile').addEventListener('click', () => {
        const fileDisplay = document.getElementById('fileDisplay');
        fileDisplay.classList.add('hidden');
        dropzone.classList.remove('hidden');
        textarea.value = '';
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

async function readFileContent(file) {
    // Check file type
    const allowedTypes = [
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/pdf'
    ];

    if (!allowedTypes.includes(file.type)) {
        throw new Error('Unsupported file type. Please upload a .txt, .doc, .docx, or .pdf file.');
    }

    // For text files, use FileReader
    if (file.type === 'text/plain') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Error reading file'));
            reader.readAsText(file);
        });
    }

    // For PDF files
    if (file.type === 'application/pdf') {
        return new Promise(async (resolve, reject) => {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = '';
                
                // Extract text from each page
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n';
                }
                
                resolve(fullText.trim());
            } catch (error) {
                reject(new Error('Error reading PDF file: ' + error.message));
            }
        });
    }

    // For DOC and DOCX files
    throw new Error('For .doc and .docx files, please copy and paste the content directly.');
}

function setupApiKeyToggle() {
    const toggleBtn = document.getElementById('toggleApiKey');
    const apiKeyInput = document.getElementById('apiKey');
    
    toggleBtn.addEventListener('click', () => {
        const type = apiKeyInput.type === 'password' ? 'text' : 'password';
        apiKeyInput.type = type;
        toggleBtn.innerHTML = `<i class="fas fa-${type === 'password' ? 'eye' : 'eye-slash'}"></i>`;
    });
}

function setupAiProviderSelection() {
    const providers = document.getElementsByName('aiProvider');
    const apiKeyInput = document.getElementById('apiKey');
    const apiKeyInfoDivs = document.querySelectorAll('#apiKeyInfo > div');
    
    function updateApiKeyInfo(providerValue) {
        // Update placeholder
        switch(providerValue) {
            case 'openai':
                apiKeyInput.placeholder = 'Enter your OpenAI API key (sk-...)';
                break;
            case 'gemini':
                apiKeyInput.placeholder = 'Enter your Google API key (AIza...)';
                break;
            case 'deepseek':
                apiKeyInput.placeholder = 'Enter your DeepSeek API key';
                break;
        }

        // Show/hide appropriate instructions
        apiKeyInfoDivs.forEach(div => {
            if (div.getAttribute('data-provider') === providerValue) {
                div.classList.remove('hidden');
            } else {
                div.classList.add('hidden');
            }
        });
    }
    
    // Set initial state
    const initialProvider = document.querySelector('input[name="aiProvider"]:checked').value;
    updateApiKeyInfo(initialProvider);

    // Handle provider changes
    providers.forEach(provider => {
        provider.addEventListener('change', () => {
            updateApiKeyInfo(provider.value);
        });
    });
}

async function handleSubmit(event) {
    event.preventDefault();
    
    // Reset any previous error messages
    hideError();
    
    // Get form inputs
    const resume = document.getElementById('resume').value.trim();
    const jobDescription = document.getElementById('jobDescription').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();
    
    // Validate inputs
    if (!validateForm(resume, jobDescription, apiKey)) {
        return;
    }
    
    // Show loading indicator and hide results
    toggleLoading(true);
    toggleResults(false);
    
    try {
        const analysis = await callAIAnalysis(resume, jobDescription, apiKey);
        displayResults(analysis);
    } catch (error) {
        displayError(error.message);
    } finally {
        toggleLoading(false);
    }
}

function validateForm(resume, jobDescription, apiKey) {
    if (!resume) {
        displayError('Please enter your resume content.');
        return false;
    }
    
    if (!jobDescription) {
        displayError('Please enter the job description.');
        return false;
    }
    
    if (!apiKey) {
        displayError('Please enter your API key.');
        return false;
    }
    
    return true;
}

async function callAIAnalysis(resume, jobDescription, apiKey) {
    const selectedProvider = document.querySelector('input[name="aiProvider"]:checked').value;
    const prompt = `
        Analyze this resume and job description. Provide:
        1. Match score (percentage)
        2. Recommendations for the candidate
        3. Analysis of talents and strengths
        4. Potential HR concerns
        
        Resume:
        ${resume}
        
        Job Description:
        ${jobDescription}
        
        Format response as JSON:
        {
            "matchScore": number,
            "recommendations": string[],
            "talentAnalysis": string[],
            "hrConcerns": string[]
        }
    `;

    try {
        let response;
        
        switch(selectedProvider) {
            case 'openai':
                response = await callOpenAI(prompt, apiKey);
                break;
            case 'gemini':
                response = await callGemini(prompt, apiKey);
                break;
            case 'deepseek':
                response = await callDeepSeek(prompt, apiKey);
                break;
            default:
                throw new Error('Invalid AI provider selected');
        }

        return response;
    } catch (error) {
        console.error('Analysis error:', error);
        throw new Error(`Failed to analyze the match: ${error.message}`);
    }
}

async function callOpenAI(prompt, apiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{
                role: "user",
                content: prompt
            }]
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
}

async function callGemini(prompt, apiKey) {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Gemini API error');
        }

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;

        try {
            // First, try to find and parse a JSON object in the response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsedJson = JSON.parse(jsonMatch[0]);
                // Validate the required fields
                if (typeof parsedJson.matchScore === 'number' &&
                    Array.isArray(parsedJson.recommendations) &&
                    Array.isArray(parsedJson.talentAnalysis) &&
                    Array.isArray(parsedJson.hrConcerns)) {
                    return parsedJson;
                }
            }
            throw new Error('Invalid JSON format');
        } catch (e) {
            // If JSON parsing fails, extract information from the text
            console.log('Falling back to text parsing');
            return {
                matchScore: extractScore(text),
                recommendations: extractList(text, "recommendations"),
                talentAnalysis: extractList(text, "talents"),
                hrConcerns: extractList(text, "concerns")
            };
        }
    } catch (error) {
        console.error('Gemini error:', error);
        throw new Error(`Failed to analyze with Gemini: ${error.message}`);
    }
}

async function callDeepSeek(prompt, apiKey) {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{
                role: "user",
                content: prompt
            }],
            temperature: 0.7,
            max_tokens: 1024
        })
    });

    if (!response.ok) {
        throw new Error('DeepSeek API error');
    }

    const data = await response.json();
    try {
        return JSON.parse(data.choices[0].message.content);
    } catch (e) {
        const text = data.choices[0].message.content;
        return {
            matchScore: extractScore(text),
            recommendations: extractList(text, "recommendations"),
            talentAnalysis: extractList(text, "talents"),
            hrConcerns: extractList(text, "concerns")
        };
    }
}

function extractScore(text) {
    const scoreMatch = text.match(/(\d+)%?/);
    return scoreMatch ? parseInt(scoreMatch[1]) : 70;
}

function extractList(text, type) {
    const lines = text.split('\n');
    const items = [];
    let capturing = false;

    for (const line of lines) {
        if (line.toLowerCase().includes(type.toLowerCase())) {
            capturing = true;
            continue;
        }
        if (capturing && line.trim() && !line.includes(':')) {
            const item = line.replace(/^[-*•]\s*/, '').trim();
            if (item) items.push(item);
        }
        if (capturing && line.trim() === '') {
            capturing = false;
        }
    }

    return items.length > 0 ? items : ['No specific ' + type + ' identified.'];
}

function displayError(message) {
    const errorElement = document.getElementById('errorMessage');
    const errorText = errorElement.querySelector('p');
    errorText.textContent = message;
    errorElement.classList.remove('hidden');
}

function hideError() {
    const errorElement = document.getElementById('errorMessage');
    errorElement.classList.add('hidden');
}

function toggleLoading(show) {
    const loadingElement = document.querySelector('.loading');
    if (show) {
        loadingElement.classList.add('active');
    } else {
        loadingElement.classList.remove('active');
    }
}

function toggleResults(show) {
    const resultsElement = document.querySelector('.results');
    if (show) {
    return 'text-red-600';
}

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
