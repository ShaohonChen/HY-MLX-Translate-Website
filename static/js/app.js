let modeDefinitions = {};

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
                modeDefinitions = Object.fromEntries(
                    (data.modes || []).map(mode => [mode.key, mode])
                );
                modeSelect.value = 'default';
                modeSelect.addEventListener('change', updateModeFields);
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
            const requestExample = document.getElementById('apiRequestExample');

            languageList.innerHTML = '';
            for (const [key, label] of Object.entries(data.languages || {})) {
                const item = document.createElement('span');
                item.className = 'api-tag';
                item.textContent = `${key}（${label}）`;
                languageList.appendChild(item);
            }

            const targetLanguage = data.quick_langs?.[0]?.key ||
                Object.keys(data.languages || {})[0] || 'Chinese';
            const request = {
                text: 'Hello, world.',
                target_language: targetLanguage
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
            const optionsPanel = document.getElementById('modeOptions');
            const definition = modeDefinitions[mode] || modeDefinitions.default || {};

            clearError();
            optionsPanel.classList.toggle('visible', mode !== 'default');
            document.getElementById('modeOptionsTitle').textContent =
                definition.label || '模式设置';
            document.getElementById('modeDescription').textContent =
                definition.description || '';

            for (const field of optionsPanel.querySelectorAll('.mode-field')) {
                field.classList.toggle('active', field.dataset.mode === mode);
            }

            if (mode === 'terminology' && !document.querySelector('.terminology-row')) {
                addTerminologyRow();
            }
        }

        function addTerminologyRow(sourceValue = '', targetValue = '') {
            const row = document.createElement('tr');
            row.className = 'terminology-row';

            const sourceCell = document.createElement('td');
            const sourceInput = document.createElement('input');
            sourceInput.className = 'mode-input term-source';
            sourceInput.type = 'text';
            sourceInput.placeholder = '例如：machine learning';
            sourceInput.setAttribute('aria-label', '原文术语');
            sourceInput.value = sourceValue;
            sourceCell.appendChild(sourceInput);

            const targetCell = document.createElement('td');
            const targetInput = document.createElement('input');
            targetInput.className = 'mode-input term-target';
            targetInput.type = 'text';
            targetInput.placeholder = '例如：机器学习';
            targetInput.setAttribute('aria-label', '期望译文');
            targetInput.value = targetValue;
            targetCell.appendChild(targetInput);

            const actionCell = document.createElement('td');
            const removeButton = document.createElement('button');
            removeButton.className = 'term-remove-btn';
            removeButton.type = 'button';
            removeButton.textContent = '删除';
            removeButton.setAttribute('aria-label', '删除这组术语');
            removeButton.addEventListener('click', () => {
                const rows = document.querySelectorAll('.terminology-row');
                if (rows.length === 1) {
                    sourceInput.value = '';
                    targetInput.value = '';
                    sourceInput.focus();
                } else {
                    row.remove();
                }
            });
            actionCell.appendChild(removeButton);

            row.append(sourceCell, targetCell, actionCell);
            document.getElementById('terminologyRows').appendChild(row);
            if (sourceValue === '' && targetValue === '') {
                sourceInput.focus();
            }
        }

        function collectModeOptions(mode) {
            if (mode === 'terminology') {
                const terminology = [];
                let incompleteInput = null;
                for (const row of document.querySelectorAll('.terminology-row')) {
                    const sourceInput = row.querySelector('.term-source');
                    const targetInput = row.querySelector('.term-target');
                    const source = sourceInput.value.trim();
                    const target = targetInput.value.trim();
                    if ((source && !target) || (!source && target)) {
                        incompleteInput = source ? targetInput : sourceInput;
                        break;
                    }
                    if (source && target) {
                        terminology.push({ source, target });
                    }
                }
                if (incompleteInput || terminology.length === 0) {
                    return {
                        error: incompleteInput ? '请补全术语对照的原文和译文' : '请至少填写一组术语对照',
                        focus: incompleteInput || document.querySelector('.term-source')
                    };
                }
                return { options: { terminology } };
            }

            if (mode === 'style') {
                const input = document.getElementById('styleInput');
                const style = input.value.trim();
                return style ? { options: { style } } :
                    { error: '请填写目标风格', focus: input };
            }

            if (mode === 'personalization') {
                const input = document.getElementById('preferencesInput');
                const preferences = input.value.split(/\r?\n/)
                    .map(item => item.trim()).filter(Boolean);
                return preferences.length ? { options: { preferences } } :
                    { error: '请至少填写一条翻译偏好', focus: input };
            }

            if (mode === 'structured_data') {
                const input = document.getElementById('formatType');
                const formatType = input.value.trim();
                return formatType ? { options: { format_type: formatType } } :
                    { error: '请填写结构化数据的格式', focus: input };
            }

            if (mode === 'background') {
                const input = document.getElementById('backgroundInput');
                const background = input.value.trim();
                return background ? { options: { background } } :
                    { error: '请填写背景信息', focus: input };
            }

            return { options: {} };
        }

        function removeLineBreaks() {
            const sourceText = document.getElementById('sourceText');

            sourceText.value = sourceText.value.replace(/[\r\n]+/g, '');
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
            const mode = document.getElementById('translationMode').value || 'default';
            const modeResult = collectModeOptions(mode);
            const modeOptions = modeResult.options || {};
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

            if (modeResult.error) {
                showError(modeResult.error);
                resultTextComplete = true;
                updateTextIndex('result');
                modeResult.focus?.focus();
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
