async function loadLanguages() {
            const select = document.getElementById('targetLanguage');
            const translateBtn = document.getElementById('translateBtn');
            select.disabled = true;
            translateBtn.disabled = true;

            try {
                const response = await fetch('/api/languages');
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const data = await response.json();

                select.innerHTML = '';

                // 填充语言下拉选择
                for (const [key, value] of Object.entries(data.languages)) {
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = `${key} (${value})`;
                    select.appendChild(option);
                }

                const modeSelect = document.getElementById('translationMode');
                modeSelect.innerHTML = '';
                for (const mode of data.modes || []) {
                    const option = document.createElement('option');
                    option.value = mode.key;
                    option.textContent = mode.label;
                    option.title = mode.description || '';
                    modeSelect.appendChild(option);
                }
                modeSelect.value = 'default';
                updateModeFields();
                updateApiDocs(data);

                // 动态生成快捷按钮
                const quickLangButtonsContainer = document.getElementById('quickLangButtons');
                quickLangButtonsContainer.innerHTML = '';
                for (const lang of data.quick_langs) {
                    const btn = document.createElement('button');
                    btn.className = 'quick-lang-btn';
                    btn.id = `quick${lang.key}Btn`;
                    btn.textContent = lang.label;
                    btn.onclick = () => selectLanguage(lang.key);
                    quickLangButtonsContainer.appendChild(btn);
                }

                // 默认设置为中文
                if (data.quick_langs.length > 0) {
                    select.value = data.quick_langs[0].key;
                } else {
                    select.value = Object.keys(data.languages)[0];
                }
                updateQuickLangButtons();
                document.getElementById('pageTitle').textContent = `${data.model} Mac 本地翻译助手`;
                document.getElementById('modelInfo').textContent =
                    `${data.language_count} 个语言选项 · 本地运行 · MLX 加速 · 流式翻译`;
            } catch (error) {
                console.error('加载语言列表失败:', error);
                select.innerHTML = '<option value="">语言列表加载失败</option>';
                showError('语言列表加载失败，请确认后端服务正常后刷新页面');
            } finally {
                select.disabled = select.options.length === 0 || !select.value;
                translateBtn.disabled = select.disabled;
            }
        }

        function updateApiDocs(data) {
            const languageList = document.getElementById('apiLanguageList');
            const modeList = document.getElementById('apiModeList');
            const requestExample = document.getElementById('apiRequestExample');

            languageList.innerHTML = '';
            for (const [key, label] of Object.entries(data.languages || {})) {
                const item = document.createElement('span');
                item.className = 'api-tag';
                item.textContent = `${key}（${label}）`;
                languageList.appendChild(item);
            }

            modeList.innerHTML = '';
            for (const mode of data.modes || []) {
                const item = document.createElement('div');
                item.className = 'api-mode';
                const key = document.createElement('strong');
                key.textContent = mode.key;
                const description = document.createElement('span');
                description.textContent = `：${mode.label} · ${mode.description || ''}`;
                item.append(key, description);
                modeList.appendChild(item);
            }

            const targetLanguage = data.quick_langs?.[0]?.key ||
                Object.keys(data.languages || {})[0] || 'Chinese';
            const request = {
                text: 'Hello, world.',
                target_language: targetLanguage,
                mode: 'default',
                mode_options: {}
            };
            requestExample.textContent = [
                'curl -X POST http://127.0.0.1:5000/api/translate/sync \\',
                '  -H "Content-Type: application/json" \\',
                `  -d '${JSON.stringify(request, null, 2)}'`
            ].join('\n');
        }

        function showError(message) {
            const errorDiv = document.getElementById('error');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }

        function clearError() {
            const errorDiv = document.getElementById('error');
            errorDiv.textContent = '';
            errorDiv.style.display = 'none';
        }

        function selectLanguage(lang) {
            const select = document.getElementById('targetLanguage');
            select.value = lang;
            updateQuickLangButtons();
        }

        function updateQuickLangButtons() {
            const select = document.getElementById('targetLanguage');
            const quickButtons = document.querySelectorAll('#quickLangButtons .quick-lang-btn');

            quickButtons.forEach(btn => {
                const langKey = btn.id.replace('quick', '').replace('Btn', '');
                btn.classList.toggle('active', select.value === langKey);
            });
        }

        function updateModeFields() {
            const mode = document.getElementById('translationMode').value;
            const label = document.getElementById('modeOptionsLabel');
            const textarea = document.getElementById('referText');
            const formatType = document.getElementById('formatType');

            const fields = {
                default: ['参考文本', '可选：提供术语、语境或参考译文'],
                terminology: ['术语对照', '每行填写一条“原文 -> 译文”对应关系'],
                style: ['翻译风格', '例如：正式、简洁、适合产品界面'],
                personalization: ['个性化要求', '例如：使用简洁句式，保留专有名词'],
                delimiters: ['补充说明', '此模式会自动要求保留分隔符'],
                structured_data: ['结构化数据说明', '可选：补充需要遵守的格式或背景信息'],
                structured_data_background: ['背景信息', '可选：提供结构化数据的背景信息']
            };
            const [labelText, placeholder] = fields[mode] || fields.default;
            label.textContent = labelText;
            textarea.placeholder = placeholder;
            formatType.classList.toggle('visible', mode === 'structured_data');
        }

        function toggleReference() {
            const referenceBtn = document.getElementById('referenceBtn');
            const referenceSection = document.getElementById('referenceSection');
            const referText = document.getElementById('referText');

            referenceSection.classList.toggle('visible');
            referenceBtn.classList.toggle('active');
            referenceBtn.setAttribute(
                'aria-expanded',
                referenceSection.classList.contains('visible')
            );

            if (!referenceSection.classList.contains('visible')) {
                referText.value = '';
            }
        }

        function removeLineBreaks() {
            const sourceText = document.getElementById('sourceText');
            const referText = document.getElementById('referText');

            sourceText.value = sourceText.value.replace(/[\r\n]+/g, '');
            if (referText.value) {
                referText.value = referText.value.replace(/[\r\n]+/g, '');
            }
            handleTextChanged('source');
        }

        function resetStats() {
            document.getElementById('stat-token-count').textContent = '0';
            document.getElementById('stat-prompt-tokens').textContent = '0';
            document.getElementById('stat-complete-tokens').textContent = '0';
            document.getElementById('stat-prefill-speed').textContent = '0';
            document.getElementById('stat-complete-speed').textContent = '0';
            document.getElementById('stat-total-time').textContent = '0';
            document.getElementById('stat-ttft').textContent = '0';
            document.getElementById('stat-tpot').textContent = '0';
        }


        let currentRequestId = null;
        let currentReader = null;
        let isTranslating = false;
        let cancelRequested = false;
        let autoScrollEnabled = true;
        let resultTextComplete = true;
        function handleButtonClick() {
            if (isTranslating) {
                cancelTranslate();
            } else {
                doTranslate();
            }
        }

        function updateStats(stats) {
            document.getElementById('stat-token-count').textContent = stats.token_count;
            document.getElementById('stat-prompt-tokens').textContent = stats.prompt_tokens;
            document.getElementById('stat-complete-tokens').textContent = stats.complete_tokens;
            document.getElementById('stat-prefill-speed').textContent = stats.prefill_speed;
            document.getElementById('stat-complete-speed').textContent = stats.complete_speed;
            document.getElementById('stat-total-time').textContent = stats.total_time;
            document.getElementById('stat-ttft').textContent = stats.ttft;
            document.getElementById('stat-tpot').textContent = stats.avg_tpot;
        }

        function updateTranslationStatus(status, btn) {
            const labels = {
                loading_model: '加载模型…',
                waiting_inference: '等待推理…',
                translating: '翻译中…'
            };
            if (!cancelRequested && labels[status]) {
                btn.innerHTML = `<span class="loading"></span>${labels[status]}`;
            }
        }

        async function doTranslate() {
            const targetLanguage = document.getElementById('targetLanguage').value;
            const sourceText = document.getElementById('sourceText').value.trim();
            const referText = document.getElementById('referText').value.trim();
            const mode = document.getElementById('translationMode').value || 'default';
            const formatType = document.getElementById('formatType').value.trim();
            const modeOptions = {};
            if (mode === 'terminology') modeOptions.terminology = referText;
            if (mode === 'style') modeOptions.style = referText;
            if (mode === 'personalization') modeOptions.preferences = referText;
            if (mode === 'structured_data' || mode === 'structured_data_background') {
                modeOptions.format_type = formatType;
            }
            if (mode === 'structured_data_background') {
                modeOptions.background = referText;
            }
            const btn = document.getElementById('translateBtn');
            const resultText = document.getElementById('resultText');

            resultText.value = '';
            resultTextComplete = false;
            updateAllTextIndexes();
            clearHighlights();
            clearError();
            resetStats();

            if (!sourceText) {
                showError('请输入要翻译的文本');
                resultTextComplete = true;
                updateTextIndex('result');
                return;
            }

            if (!targetLanguage) {
                showError('请选择目标语言');
                resultTextComplete = true;
                updateTextIndex('result');
                return;
            }

            isTranslating = true;
            cancelRequested = false;
            autoScrollEnabled = true;
            currentRequestId = window.crypto?.randomUUID?.() ||
                `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            btn.innerHTML = '<span class="loading"></span>翻译中…';
            btn.classList.add('btn-cancel');

            try {
                const response = await fetch('/api/translate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        text: sourceText,
                        target_language: targetLanguage,
                        request_id: currentRequestId,
                        refer_text: referText,
                        mode,
                        mode_options: modeOptions
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    showError(errorData.error || `翻译失败（HTTP ${response.status}）`);
                    return;
                }
                if (!response.body) {
                    throw new Error('浏览器不支持流式响应');
                }

                currentReader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let streamFailed = false;

                const processFrame = frame => {
                    const dataLine = frame.split('\n').find(line => line.startsWith('data: '));
                    if (!dataLine) {
                        return;
                    }
                    try {
                        const data = JSON.parse(dataLine.slice(6));
                        if (data.type === 'text') {
                            resultText.value += data.content;
                            updateTextIndex('result');
                            refreshActiveHighlight();
                            if (autoScrollEnabled) {
                                resultText.scrollTop = resultText.scrollHeight;
                                syncHighlightScroll('result');
                            }
                        } else if (data.type === 'status') {
                            updateTranslationStatus(data.content, btn);
                        } else if (data.type === 'error') {
                            streamFailed = true;
                            showError(data.content || '模型推理失败');
                        } else if (data.type === 'stats') {
                            updateStats(data.content);
                        }
                    } catch (error) {
                        console.error('解析流式数据失败:', error, frame);
                    }
                };

                while (true) {
                    const { done, value } = await currentReader.read();
                    if (done) {
                        buffer += decoder.decode();
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const frames = buffer.split(/\r?\n\r?\n/);
                    buffer = frames.pop();
                    for (const frame of frames) {
                        processFrame(frame);
                    }
                }

                if (buffer.trim()) {
                    processFrame(buffer);
                }
                if (!streamFailed && !cancelRequested && !resultText.value) {
                    showError('模型未返回翻译结果');
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('翻译请求失败:', error);
                    showError(error.message || '网络错误，请稍后重试');
                }
            } finally {
                isTranslating = false;
                cancelRequested = false;
                resultTextComplete = true;
                updateTextIndex('result');
                refreshActiveHighlight();
                currentReader = null;
                currentRequestId = null;
                btn.disabled = false;
                btn.innerHTML = '翻译';
                btn.classList.remove('btn-cancel');
            }
        }

        async function cancelTranslate() {
            if (!isTranslating || !currentRequestId) {
                return;
            }

            cancelRequested = true;
            const btn = document.getElementById('translateBtn');
            btn.disabled = true;
            btn.innerHTML = '<span class="loading"></span>正在取消…';

            try {
                const response = await fetch('/api/cancel', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        request_id: currentRequestId
                    })
                });
                if (!response.ok && response.status !== 404) {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                console.error('取消翻译请求失败:', error);
                cancelRequested = false;
                btn.disabled = false;
                btn.innerHTML = '<span class="loading"></span>翻译中…';
                showError('取消请求失败，翻译仍在继续');
            }
        }
