require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs' } });

require(['vs/editor/editor.main'], function () {
    // Initialize the editors
    const leftEditor = monaco.editor.create(document.getElementById('leftEditor'), {
        value: '',
        language: 'json',
        theme: 'vs-dark',
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true
    });

    const rightEditor = monaco.editor.create(document.getElementById('rightEditor'), {
        value: '',
        language: 'json',
        theme: 'vs-dark',
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        readOnly: true
    });

    // Language-specific formatters
    const formatters = {
        json: {
            format: (code) => JSON.stringify(JSON.parse(code), null, 2),
            minify: (code) => JSON.stringify(JSON.parse(code)),
            validate: (code) => JSON.parse(code)
        },
        html: {
            format: (code) => {
                try {
                    // First try to format with prettier
                    try {
                        return prettier.format(code, {
                            parser: 'html',
                            plugins: [prettierPlugins.html],
                            printWidth: 80,
                            tabWidth: 2,
                            useTabs: false,
                            htmlWhitespaceSensitivity: 'css',
                            bracketSameLine: false,
                            endOfLine: 'lf'
                        });
                    } catch (prettierError) {
                        console.warn('Prettier HTML formatting failed, using fallback formatter:', prettierError);
                        
                        // Fallback formatter
                        const formatted = code
                            // Remove extra whitespace
                            .replace(/^\s+|\s+$/g, '')
                            // Add newline after elements
                            .replace(/>/g, '>\n')
                            // Add newline before elements
                            .replace(/<(?!\/)/g, '\n<')
                            // Remove empty lines
                            .replace(/^\s*[\r\n]/gm, '')
                            // Split into lines
                            .split('\n')
                            // Add proper indentation
                            .map((line) => {
                                let indent = 0;
                                if (line.match(/<\//)) indent--;
                                const spaces = '  '.repeat(Math.max(0, indent));
                                if (line.match(/<[^/].*[^/]>$/)) indent++;
                                return spaces + line.trim();
                            })
                            .join('\n');
                        
                        return formatted;
                    }
                } catch (error) {
                    console.error('HTML formatting error:', error);
                    throw error;
                }
            },
            minify: (code) => {
                return code
                    .replace(/\s+/g, ' ')
                    .replace(/>\s+</g, '><')
                    .replace(/\s+>/g, '>')
                    .replace(/>\s+/g, '>')
                    .replace(/\s+\/>/g, '/>')
                    .trim();
            },
            validate: (code) => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(code, 'text/html');
                const errors = doc.getElementsByTagName('parsererror');
                if (errors.length > 0) {
                    throw new Error('Invalid HTML: ' + errors[0].textContent);
                }
                return true;
            }
        },
        css: {
            format: (code) => {
                try {
                    // First try to format with prettier
                    try {
                        return prettier.format(code, {
                            parser: 'css',
                            plugins: [prettierPlugins.postcss],
                            printWidth: 80,
                            tabWidth: 2,
                            useTabs: false,
                            singleQuote: true
                        });
                    } catch (prettierError) {
                        console.warn('Prettier CSS formatting failed, using fallback formatter:', prettierError);
                        
                        // Fallback CSS formatter with better spacing
                        return code
                            // Initial cleanup
                            .replace(/\s+/g, ' ')
                            .replace(/\s*{\s*/g, ' {\n')
                            .replace(/\s*}\s*/g, '}\n\n')
                            .replace(/\s*;\s*/g, ';\n')
                            .replace(/\s*,\s*/g, ', ')
                            .replace(/\s*:\s*/g, ': ')
                            // Split into lines and process
                            .split('\n')
                            .map(line => line.trim())
                            .filter(line => line.length > 0)
                            .map((line, _, array) => {
                                // Calculate indentation
                                let indent = 0;
                                array.slice(0, array.indexOf(line)).forEach(l => {
                                    if (l.includes('{')) indent++;
                                    if (l.includes('}')) indent--;
                                });
                                
                                // Add proper indentation
                                const spaces = '  '.repeat(Math.max(0, indent));
                                
                                // Special handling for closing braces
                                if (line.includes('}')) {
                                    indent--;
                                    return spaces + line;
                                }
                                
                                // Add indentation to the line
                                return spaces + line;
                            })
                            .join('\n')
                            // Final cleanup
                            .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove extra blank lines
                            .trim() + '\n';
                    }
                } catch (error) {
                    console.error('CSS formatting error:', error);
                    throw error;
                }
            },
            minify: (code) => {
                return code
                    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
                    .replace(/([^0-9a-zA-Z.#])\s+/g, '$1') // Remove spaces after tokens
                    .replace(/\s+([^0-9a-zA-Z.#])/g, '$1') // Remove spaces before tokens
                    .replace(/;}/g, '}') // Remove last semicolon
                    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                    .trim();
            },
            validate: (code) => {
                try {
                    const style = document.createElement('style');
                    style.textContent = code;
                    document.head.appendChild(style);
                    const isValid = style.sheet !== null;
                    document.head.removeChild(style);
                    if (!isValid) throw new Error('Invalid CSS');
                    return true;
                } catch (error) {
                    throw new Error('Invalid CSS: ' + error.message);
                }
            }
        },
        javascript: {
            format: (code) => {
                try {
                    return prettier.format(code, {
                        parser: 'babel',
                        plugins: [prettierPlugins.babel],
                        printWidth: 80,
                        tabWidth: 2,
                        useTabs: false,
                        semi: true,
                        singleQuote: true,
                        trailingComma: 'es5'
                    });
                } catch (error) {
                    console.error('JavaScript formatting error:', error);
                    throw error;
                }
            },
            minify: (code) => code.replace(/\s+/g, ' ').trim(),
            validate: (code) => {
                new Function(code);
                return true;
            }
        }
    };

    // Sample data for different languages
    const samples = {
        json: {
            "ROOT": {
                "type": { "resolvedName": "Container" },
                "isCanvas": true,
                "props": { "id": "root" }
            }
        },
        html: `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <title>Sample</title>
                    <style>
                        .container { padding: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Hello World</h1>
                        <p>This is a <strong>sample</strong> paragraph with <a href="#">link</a>.</p>
                        <ul>
                            <li>Item 1</li>
                            <li>Item 2</li>
                        </ul>
                    </div>
                </body>
            </html>
        `,
        css: `
            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                background: #fff;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
        `,
        javascript: `
            function calculateSum(a, b) {
                return a + b;
            }
            
            const multiply = (x, y) => {
                return x * y;
            }
        `
    };

    // Event Handlers
    const getCurrentLanguage = () => document.getElementById('languageSelect').value;

    const handleFormat = () => {
        try {
            const language = getCurrentLanguage();
            const value = leftEditor.getValue();
            const formatted = formatters[language].format(value);
            rightEditor.setValue(formatted);
        } catch (error) {
            alert(`Invalid ${getCurrentLanguage().toUpperCase()}: ${error.message}`);
        }
    };

    const handleMinify = () => {
        try {
            const language = getCurrentLanguage();
            const value = leftEditor.getValue();
            const minified = formatters[language].minify(value);
            rightEditor.setValue(minified);
        } catch (error) {
            alert(`Invalid ${getCurrentLanguage().toUpperCase()}: ${error.message}`);
        }
    };

    const handleValidate = () => {
        try {
            const language = getCurrentLanguage();
            const value = leftEditor.getValue();
            formatters[language].validate(value);
            alert(`Valid ${language.toUpperCase()}!`);
        } catch (error) {
            alert(`Invalid ${getCurrentLanguage().toUpperCase()}: ${error.message}`);
        }
    };

    // Language change handler
    document.getElementById('languageSelect').addEventListener('change', (e) => {
        const language = e.target.value;
        leftEditor.setModel(monaco.editor.createModel('', language));
        rightEditor.setModel(monaco.editor.createModel('', language));
    });

    // Button Event Listeners
    document.getElementById('formatBtn').addEventListener('click', handleFormat);
    document.getElementById('minifyBtn').addEventListener('click', handleMinify);
    document.getElementById('validateBtn').addEventListener('click', handleValidate);

    document.getElementById('copyBtn').addEventListener('click', () => {
        const value = leftEditor.getValue();
        navigator.clipboard.writeText(value);
    });

    document.getElementById('downloadBtn').addEventListener('click', () => {
        const language = getCurrentLanguage();
        const value = rightEditor.getValue();
        const extensions = {
            json: 'json',
            html: 'html',
            css: 'css',
            javascript: 'js'
        };
        const blob = new Blob([value], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `formatted.${extensions[language]}`;
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('uploadBtn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.html,.css,.js,.javascript';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const detectedLanguage = detectLanguage(content);
                updateLanguageSelect(detectedLanguage);
                leftEditor.setValue(content);
            };
            reader.readAsText(file);
        };
        input.click();
    });

    // Add paste event listener to the left editor
    leftEditor.onDidPaste(() => {
        setTimeout(() => {
            const content = leftEditor.getValue();
            if (content) {
                const detectedLanguage = detectLanguage(content);
                const select = document.getElementById('languageSelect');
                select.value = detectedLanguage;
                
                // Create new model with detected language
                const oldModel = leftEditor.getModel();
                const newModel = monaco.editor.createModel(content, detectedLanguage);
                leftEditor.setModel(newModel);
                if (oldModel) {
                    oldModel.dispose();
                }
                
                // Update right editor model
                const oldRightModel = rightEditor.getModel();
                const newRightModel = monaco.editor.createModel('', detectedLanguage);
                rightEditor.setModel(newRightModel);
                if (oldRightModel) {
                    oldRightModel.dispose();
                }
            }
        }, 0);
    });

    // Update the updateLanguageSelect function
    const updateLanguageSelect = (language) => {
        const select = document.getElementById('languageSelect');
        select.value = language;
        
        // Get current content
        const content = leftEditor.getValue();
        
        // Create new models with the new language
        const oldLeftModel = leftEditor.getModel();
        const newLeftModel = monaco.editor.createModel(content, language);
        leftEditor.setModel(newLeftModel);
        if (oldLeftModel) {
            oldLeftModel.dispose();
        }
        
        const oldRightModel = rightEditor.getModel();
        const newRightModel = monaco.editor.createModel(rightEditor.getValue(), language);
        rightEditor.setModel(newRightModel);
        if (oldRightModel) {
            oldRightModel.dispose();
        }
    };

    // Update the setValue override
    const originalSetValue = leftEditor.setValue;
    leftEditor.setValue = (value) => {
        if (value) {
            const detectedLanguage = detectLanguage(value);
            const currentLanguage = leftEditor.getModel().getLanguageId();
            
            if (detectedLanguage !== currentLanguage) {
                updateLanguageSelect(detectedLanguage);
            }
        }
        return originalSetValue.call(leftEditor, value);
    };

    // Add this function after the formatters object
    const detectLanguage = (code) => {
        // Remove leading/trailing whitespace
        code = code.trim();
        
        // Try to detect JSON
        try {
            JSON.parse(code);
            return 'json';
        } catch (e) {
            // Not JSON, continue checking
        }

        // Check for HTML
        if (code.match(/<[^>]*>/) || code.toLowerCase().includes('<!doctype html')) {
            return 'html';
        }

        // Check for CSS
        if (code.match(/{[\s\S]*}/) && 
            (code.match(/[.#][\w-]+\s*{/) || // Class or ID selector
             code.match(/@media/) ||          // Media queries
             code.match(/@keyframes/) ||      // Animations
             code.match(/^[\w-]+\s*{/))) {    // Element selector
            return 'css';
        }

        // Check for JavaScript
        if (code.match(/function\s+\w+\s*\(/) ||   // Function declaration
            code.match(/const\s+\w+\s*=/) ||       // Const declaration
            code.match(/let\s+\w+\s*=/) ||         // Let declaration
            code.match(/var\s+\w+\s*=/) ||         // Var declaration
            code.match(/class\s+\w+/) ||           // Class declaration
            code.match(/=>\s*{/)) {                // Arrow function
            return 'javascript';
        }

        // Default to JavaScript if no other match
        return 'javascript';
    };

    // Add this with the other event listeners
    document.getElementById('copyRightBtn').addEventListener('click', () => {
        const value = rightEditor.getValue();
        navigator.clipboard.writeText(value);
    });

    // Add debounce function
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    // Add auto format handler
    const handleAutoFormat = debounce(() => {
        if (document.getElementById('autoFormat').checked) {
            handleFormat();
        }
    }, 1000);

    // Add content change listener to left editor
    leftEditor.onDidChangeModelContent(() => {
        handleAutoFormat();
    });
}); 