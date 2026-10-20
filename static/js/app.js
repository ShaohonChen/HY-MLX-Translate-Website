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
                updateTranslationButtons();
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
            updateTranslationButtons();
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

        function joinWrappedLines() {
            const sourceText = document.getElementById('sourceText');
            const text = sourceText.value;

            // 先合并断词：行尾连字符是排版断词的一部分，不属于原文。
            // 使用 Unicode 字母/数字，兼容中文、日文等非 ASCII 文本。
            let joinedText = text.replace(
                /([\p{L}\p{N}])-[ \t]*(?:\r?\n)+[ \t]*(?=[\p{L}\p{N}])/gu,
                '$1'
            );

            // 其他换行通常发生在两个词之间，需要补一个空格；
            // 如果换行紧邻标点，则直接拼接，避免出现 "word ," 这类结果。
            joinedText = joinedText.replace(
                /[ \t]*(?:\r?\n)+[ \t]*/g,
                (lineBreak, offset, fullText) => {
                    const previous = fullText[offset - 1] || '';
                    const next = fullText[offset + lineBreak.length] || '';
                    if (!previous || !next) {
                        return '';
                    }
                    if (/[,.;:!?%\u3001\u3002\uFF0C\uFF01\uFF1F\uFF1B\uFF1A\u2014)\]}>&"'\u201D\u2019\uFF09\u3011\u3009\u300D\u300F]/u.test(next)) {
                        return '';
                    }
                    if (/[([{\u3008\u300A\u300C\u300E<\u201C\u2018\uFF08\u3010\u3008\u300C\u300E]/u.test(previous)) {
                        return '';
                    }
                    // 中日韩文字本身不以空格分词，避免把中文段落变成逐句带空格。
                    if (/^[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]$/u.test(previous) &&
                        /^[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]$/u.test(next)) {
                        return '';
                    }
                    return ' ';
                }
            );

            sourceText.value = joinedText;
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


// Both entry points share one task; only full translation updates text matching.
const translationTargets = {
    full: { buttonId: 'translateBtn', resultId: 'resultText', label: '翻译' },
    selection: {
        buttonId: 'translateSelectionBtn',
        resultId: 'selectionResultText',
        label: '翻译选中文本'
    }
};
const translationStatusLabels = {
    loading_model: '加载模型…',
    waiting_inference: '等待推理…',
    translating: '取消翻译'
};
let activeTask = null;
let sourceSelection = null;
let resultTextComplete = true;

function getSelectedSourceText() {
    const source = document.getElementById('sourceText');
    if (!sourceSelection || sourceSelection.value !== source.value) {
        return '';
    }
    return source.value.slice(sourceSelection.start, sourceSelection.end);
}

function captureSourceSelection() {
    const source = document.getElementById('sourceText');
    sourceSelection = source.selectionStart === source.selectionEnd ? null : {
        start: source.selectionStart,
        end: source.selectionEnd,
        value: source.value
    };
    updateTranslationButtons();
}

function clearSourceSelection() {
    sourceSelection = null;
    updateTranslationButtons();
}

function updateTranslationButtons() {
    const language = document.getElementById('targetLanguage');
    const languageReady = !language.disabled && Boolean(language.value);
    for (const [kind, target] of Object.entries(translationTargets)) {
        const button = document.getElementById(target.buttonId);
        const running = activeTask?.kind === kind;
        button.classList.toggle('btn-cancel', running);
        if (running) {
            button.disabled = activeTask.cancelRequested;
            const label = activeTask.cancelRequested ? '正在取消…' :
                translationStatusLabels[activeTask.status];
            button.innerHTML = `<span class="loading" aria-hidden="true"></span>${label}`;
            button.title = '取消当前翻译';
            button.setAttribute('aria-label', label);
        } else {
            button.textContent = target.label;
            button.disabled = Boolean(activeTask) || !languageReady ||
                (kind === 'selection' && !getSelectedSourceText().trim());
            button.title = kind === 'selection' ? '选中左侧原文后翻译' : '翻译全部原文';
            button.setAttribute('aria-label', target.label);
        }
    }
}

function handleButtonClick(kind = 'full') {
    if (activeTask) {
        if (activeTask.kind === kind) {
            cancelTranslate();
        }
        return;
    }
    doTranslate(kind);
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

function stopTranslationAutoScroll(kind) {
    if (activeTask?.kind === kind) {
        activeTask.autoScrollEnabled = false;
    }
}

function refreshTranslationResult(task) {
    if (task.kind === 'full') {
        updateTextIndex('result');
        refreshActiveHighlight();
    }
    if (task.autoScrollEnabled) {
        task.result.scrollTop = task.result.scrollHeight;
        if (task.kind === 'full') {
            syncHighlightScroll('result');
        }
    }
}

async function doTranslate(kind = 'full') {
    if (activeTask || !translationTargets[kind]) {
        return;
    }
    const sourceText = kind === 'selection' ? getSelectedSourceText() :
        document.getElementById('sourceText').value.trim();
    const targetLanguage = document.getElementById('targetLanguage').value;
    const mode = document.getElementById('translationMode').value || 'default';
    const modeResult = collectModeOptions(mode);
    clearError();

    // Validate before replacing either result or starting a task.
    if (!sourceText.trim()) {
        showError(kind === 'selection' ? '请先选中左侧原文中的文本' : '请输入要翻译的文本');
        return;
    }
    if (!targetLanguage) {
        showError('请选择目标语言');
        return;
    }
    if (modeResult.error) {
        showError(modeResult.error);
        modeResult.focus?.focus();
        return;
    }

    const task = {
        kind,
        requestId: window.crypto?.randomUUID?.() ||
            `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        result: document.getElementById(translationTargets[kind].resultId),
        status: 'translating',
        cancelRequested: false,
        responseReceived: false,
        autoScrollEnabled: true
    };
    activeTask = task;
    task.result.value = '';
    task.result.placeholder = '翻译结果将在这里实时生成';
    task.result.setAttribute('aria-busy', 'true');
    if (kind === 'full') {
        resultTextComplete = false;
        updateAllTextIndexes();
        clearHighlights();
    } else {
        const panel = document.getElementById('selectionTranslation');
        panel.hidden = false;
        panel.open = true;
    }
    resetStats();
    updateTranslationButtons();

    let reader = null;
    try {
        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: sourceText,
                target_language: targetLanguage,
                request_id: task.requestId,
                mode,
                mode_options: modeResult.options || {}
            })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `翻译失败（HTTP ${response.status}）`);
        }
        if (!response.body) {
            throw new Error('浏览器不支持流式响应');
        }
        reader = response.body.getReader();
        task.responseReceived = true;
        // A click before response headers must wait until the server registers the request.
        if (task.cancelRequested) {
            await cancelTranslate(task);
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let streamFailed = false;
        const processFrame = frame => {
            const dataLine = frame.split('\n').find(line => line.startsWith('data: '));
            if (!dataLine) {
                return;
            }
            let data;
            try {
                data = JSON.parse(dataLine.slice(6));
            } catch (error) {
                console.error('解析流式数据失败:', error, frame);
                return;
            }
            if (data.type === 'text') {
                task.result.value += data.content;
                refreshTranslationResult(task);
            } else if (data.type === 'status' && translationStatusLabels[data.content]) {
                task.status = data.content;
                updateTranslationButtons();
            } else if (data.type === 'error') {
                streamFailed = true;
                showError(data.content || '模型推理失败');
            } else if (data.type === 'stats') {
                updateStats(data.content);
                if (data.content.cancelled) {
                    task.result.placeholder = '翻译已取消';
                }
            }
        };

        while (true) {
            const { done, value } = await reader.read();
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
        if (!streamFailed && !task.cancelRequested && !task.result.value) {
            showError('模型未返回翻译结果');
        }
    } catch (error) {
        console.error('翻译请求失败:', error);
        showError(error.message || '网络错误，请稍后重试');
    } finally {
        reader?.releaseLock();
        task.result.setAttribute('aria-busy', 'false');
        if (kind === 'full') {
            resultTextComplete = true;
            updateTextIndex('result');
            refreshActiveHighlight();
        }
        activeTask = null;
        updateTranslationButtons();
    }
}

async function cancelTranslate(task = activeTask) {
    if (!task || activeTask !== task) {
        return;
    }
    task.cancelRequested = true;
    updateTranslationButtons();
    if (!task.responseReceived) {
        return;
    }
    try {
        const response = await fetch('/api/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ request_id: task.requestId })
        });
        if (!response.ok && response.status !== 404) {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        // An old cancellation response must not affect a later task.
        if (activeTask === task) {
            task.cancelRequested = false;
            updateTranslationButtons();
            console.error('取消翻译请求失败:', error);
            showError('取消请求失败，翻译仍在继续');
        }
    }
}

const selectionSource = document.getElementById('sourceText');
for (const eventName of ['select', 'mouseup', 'keyup', 'touchend', 'focus', 'blur']) {
    selectionSource.addEventListener(eventName, captureSourceSelection);
}
document.addEventListener('selectionchange', () => {
    if (document.activeElement === selectionSource) {
        captureSourceSelection();
    }
});
for (const kind of ['full', 'selection']) {
    const result = document.getElementById(translationTargets[kind].resultId);
    result.addEventListener('focus', clearSourceSelection);
    result.addEventListener('wheel', () => stopTranslationAutoScroll(kind));
    result.addEventListener('touchmove', () => stopTranslationAutoScroll(kind));
    result.addEventListener('select', () => stopTranslationAutoScroll(kind));
}
