let activeSelectionSide = null;
        let selectionTimer = null;
        let sentenceSegmenter = null;

            const sourceTextarea = document.getElementById('sourceText');
            const resultTextarea = document.getElementById('resultText');
            const sourceHighlightLayer = document.getElementById('sourceHighlight');
            const resultHighlightLayer = document.getElementById('resultHighlight');
            const textIndexes = {
                source: null,
                result: null
            };
            const SENTENCE_END_PATTERN = /[。！？.!?]/;
            const SENTENCE_CLOSER_PATTERN = /["'”’）)\]】》」』]/;
            const CONTINUATION_START_PATTERN = /[a-z0-9\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af,，、;；:：）)\]】》」』]/;
            const ABBREVIATION_TAIL_PATTERN = /(?:^|[\s([（【「『,，、;；:：])((?:[A-Za-z]\.){2,}|[A-Za-z]{1,12}\.)$/;
            const DOTTED_ABBREVIATION_PATTERN = /^(?:[A-Za-z]\.){2,}$/;
            const ALPHA_DOT_PATTERN = /[A-Za-z.]/;
            const WHITESPACE_PATTERN = /\s/;
            const HARD_ABBREVIATIONS = new Set([
                'e.g.', 'i.e.', 'vs.', 'cf.', 'mr.', 'mrs.', 'ms.', 'dr.',
                'prof.', 'sr.', 'jr.', 'st.'
            ]);
            const SOFT_ABBREVIATIONS = new Set([
                'etc.', 'al.', 'fig.', 'eq.', 'ref.', 'no.', 'vol.', 'pp.',
                'inc.', 'ltd.', 'co.', 'corp.', 'dept.', 'univ.'
            ]);

            function getTextarea(side) {
                return side === 'source' ? sourceTextarea : resultTextarea;
            }

            function getHighlightLayer(side) {
                return side === 'source' ? sourceHighlightLayer : resultHighlightLayer;
            }

            function getOtherSide(side) {
                return side === 'source' ? 'result' : 'source';
            }

            function escapeHtml(text) {
                return text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }

            function hasSentenceEnd(text) {
                const trimmed = trimSentenceClosers(text.trim());
                if (!trimmed) {
                    return false;
                }

                const endIndex = trimmed.length - 1;
                const endChar = trimmed[endIndex];
                return SENTENCE_END_PATTERN.test(endChar) &&
                    (endChar !== '.' || !isAbbreviationPeriod(trimmed, endIndex, false));
            }

            function getSentenceBoundaryEnd(text, punctuationIndex) {
                let end = punctuationIndex + 1;
                while (end < text.length && SENTENCE_END_PATTERN.test(text[end])) {
                    end += 1;
                }
                while (end < text.length && SENTENCE_CLOSER_PATTERN.test(text[end])) {
                    end += 1;
                }
                return end;
            }

            function getLastBoundaryCharIndex(text, offset) {
                let index = offset - 1;
                while (index >= 0 && WHITESPACE_PATTERN.test(text[index])) {
                    index -= 1;
                }
                while (index >= 0 && SENTENCE_CLOSER_PATTERN.test(text[index])) {
                    index -= 1;
                }
                return index;
            }

            function getFirstContentChar(text, offset) {
                for (let index = offset; index < text.length; index += 1) {
                    if (!WHITESPACE_PATTERN.test(text[index])) {
                        return text[index];
                    }
                }
                return '';
            }

            function trimSentenceClosers(text) {
                let end = text.length;
                while (end > 0 && SENTENCE_CLOSER_PATTERN.test(text[end - 1])) {
                    end -= 1;
                }
                return text.slice(0, end);
            }

            function getAlphaDotToken(text, offset) {
                let start = offset;
                let end = offset + 1;
                while (start > 0 && ALPHA_DOT_PATTERN.test(text[start - 1])) {
                    start -= 1;
                }
                while (end < text.length && ALPHA_DOT_PATTERN.test(text[end])) {
                    end += 1;
                }
                return { end, value: text.slice(start, end) };
            }

            function getAbbreviationBefore(text, dotIndex) {
                const prefix = trimSentenceClosers(text.slice(0, dotIndex + 1)).trim();
                return prefix.match(ABBREVIATION_TAIL_PATTERN)?.[1].toLowerCase() || '';
            }

            function isInsideDottedAbbreviation(text, dotIndex) {
                const token = getAlphaDotToken(text, dotIndex);
                return DOTTED_ABBREVIATION_PATTERN.test(token.value) && dotIndex < token.end - 1;
            }

            function isKnownAbbreviation(abbreviation) {
                return HARD_ABBREVIATIONS.has(abbreviation) ||
                    SOFT_ABBREVIATIONS.has(abbreviation) ||
                    DOTTED_ABBREVIATION_PATTERN.test(abbreviation);
            }

            function isAbbreviationPeriod(text, dotIndex, textComplete) {
                if (isInsideDottedAbbreviation(text, dotIndex)) {
                    return true;
                }

                const abbreviation = getAbbreviationBefore(text, dotIndex);
                if (!isKnownAbbreviation(abbreviation)) {
                    return false;
                }

                const nextChar = getFirstContentChar(text, getSentenceBoundaryEnd(text, dotIndex));
                if (!nextChar) {
                    return !textComplete;
                }

                return HARD_ABBREVIATIONS.has(abbreviation) ||
                    CONTINUATION_START_PATTERN.test(nextChar);
            }

            function addSentence(sentences, paragraphText, paragraphStart, rawStart, rawEnd, textComplete) {
                let start = rawStart;
                let end = rawEnd;

                while (start < end && WHITESPACE_PATTERN.test(paragraphText[start])) {
                    start += 1;
                }
                while (end > start && WHITESPACE_PATTERN.test(paragraphText[end - 1])) {
                    end -= 1;
                }
                if (start >= end) {
                    return;
                }

                const content = paragraphText.slice(start, end);
                sentences.push({
                    sentenceIndex: sentences.length,
                    start: paragraphStart + start,
                    end: paragraphStart + end,
                    isComplete: textComplete || hasSentenceEnd(content)
                });
            }

            function getSentenceSegmenter() {
                if (!('Intl' in window) || !('Segmenter' in Intl)) {
                    return null;
                }
                if (!sentenceSegmenter) {
                    sentenceSegmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
                }
                return sentenceSegmenter;
            }

            function shouldSplitAt(text, punctuationIndex, textComplete) {
                const char = text[punctuationIndex];
                return char !== '.' || !isAbbreviationPeriod(text, punctuationIndex, textComplete);
            }

            function mergeAbbreviationSegments(segments, text, textComplete) {
                const merged = [];
                for (const current of segments) {
                    const previous = merged[merged.length - 1];
                    const boundaryIndex = previous ? getLastBoundaryCharIndex(text, previous.end) : -1;

                    if (previous && !shouldSplitAt(text, boundaryIndex, textComplete)) {
                        previous.end = current.end;
                    } else {
                        merged.push({ ...current });
                    }
                }
                return merged;
            }

            function splitByPunctuation(text, textComplete) {
                const ranges = [];
                let start = 0;
                let index = 0;

                while (index < text.length) {
                    if (!SENTENCE_END_PATTERN.test(text[index])) {
                        index += 1;
                        continue;
                    }

                    const end = getSentenceBoundaryEnd(text, index);
                    if (shouldSplitAt(text, index, textComplete)) {
                        ranges.push({ start, end });
                        start = end;
                    }
                    index = end;
                }

                if (start < text.length) {
                    ranges.push({ start, end: text.length });
                }
                return ranges;
            }

            function getSentenceRanges(text, textComplete) {
                const segmenter = getSentenceSegmenter();
                if (!segmenter) {
                    return splitByPunctuation(text, textComplete);
                }

                const ranges = Array.from(segmenter.segment(text), segment => ({
                    start: segment.index,
                    end: segment.index + segment.segment.length
                }));
                return mergeAbbreviationSegments(ranges, text, textComplete);
            }

            function splitSentences(paragraphText, paragraphStart, textComplete) {
                const sentences = [];
                for (const range of getSentenceRanges(paragraphText, textComplete)) {
                    addSentence(sentences, paragraphText, paragraphStart, range.start, range.end, textComplete);
                }
                return sentences;
            }

            function buildTextIndex(text, textComplete) {
                const paragraphs = [];
                const paragraphPattern = /[^\r\n]+/g;
                let match;

                while ((match = paragraphPattern.exec(text)) !== null) {
                    if (!match[0].trim()) {
                        continue;
                    }
                    const paragraph = {
                        paragraphIndex: paragraphs.length,
                        start: match.index,
                        end: match.index + match[0].length,
                        sentences: splitSentences(match[0], match.index, textComplete)
                    };
                    paragraphs.push(paragraph);
                }

                return {
                    text,
                    paragraphs
                };
            }

            function updateTextIndex(side) {
                const textarea = getTextarea(side);
                const textComplete = side === 'source' ? true : resultTextComplete;
                textIndexes[side] = buildTextIndex(textarea.value, textComplete);
            }

            function updateAllTextIndexes() {
                updateTextIndex('source');
                updateTextIndex('result');
            }

            function rangesIntersect(startA, endA, startB, endB) {
                return startA < endB && endA > startB;
            }

            function getTouchedParagraphs(index, selectionStart, selectionEnd) {
                return index.paragraphs.filter(paragraph => (
                    rangesIntersect(selectionStart, selectionEnd, paragraph.start, paragraph.end)
                ));
            }

            function getTouchedSentences(paragraph, selectionStart, selectionEnd) {
                return paragraph.sentences.filter(sentence => (
                    sentence.isComplete &&
                    rangesIntersect(selectionStart, selectionEnd, sentence.start, sentence.end)
                ));
            }

            function mapParagraphsToRanges(paragraphs, targetIndex) {
                const firstIndex = paragraphs[0].paragraphIndex;
                const lastIndex = paragraphs[paragraphs.length - 1].paragraphIndex;

                return targetIndex.paragraphs
                    .filter(paragraph => (
                        paragraph.paragraphIndex >= firstIndex &&
                        paragraph.paragraphIndex <= lastIndex
                    ))
                    .map(paragraph => ({
                        start: paragraph.start,
                        end: paragraph.end
                    }));
            }

            function mapSentencesToRanges(paragraph, sentences, targetIndex) {
                const targetParagraph = targetIndex.paragraphs.find(item => (
                    item.paragraphIndex === paragraph.paragraphIndex
                ));
                if (!targetParagraph) {
                    return [];
                }

                const firstIndex = sentences[0].sentenceIndex;
                const lastIndex = sentences[sentences.length - 1].sentenceIndex;

                return targetParagraph.sentences
                    .filter(sentence => (
                        sentence.isComplete &&
                        sentence.sentenceIndex >= firstIndex &&
                        sentence.sentenceIndex <= lastIndex
                    ))
                    .map(sentence => ({
                        start: sentence.start,
                        end: sentence.end
                    }));
            }

            function getMatchedRanges(side) {
                const textarea = getTextarea(side);
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                if (start === end) {
                    return [];
                }

                updateAllTextIndexes();

                const sourceIndex = textIndexes[side];
                const targetIndex = textIndexes[getOtherSide(side)];
                if (!sourceIndex || !targetIndex || !targetIndex.text) {
                    return [];
                }

                const touchedParagraphs = getTouchedParagraphs(sourceIndex, start, end);
                if (touchedParagraphs.length === 0) {
                    return [];
                }

                if (touchedParagraphs.length > 1) {
                    return mapParagraphsToRanges(touchedParagraphs, targetIndex);
                }

                const touchedSentences = getTouchedSentences(touchedParagraphs[0], start, end);
                if (touchedSentences.length === 0) {
                    return [];
                }

                return mapSentencesToRanges(touchedParagraphs[0], touchedSentences, targetIndex);
            }

            function mergeRanges(ranges, textLength) {
                const normalized = ranges
                    .map(range => ({
                        start: Math.max(0, Math.min(range.start, textLength)),
                        end: Math.max(0, Math.min(range.end, textLength))
                    }))
                    .filter(range => range.start < range.end)
                    .sort((a, b) => a.start - b.start);

                const merged = [];
                for (const range of normalized) {
                    const last = merged[merged.length - 1];
                    if (last && range.start <= last.end) {
                        last.end = Math.max(last.end, range.end);
                    } else {
                        merged.push({ ...range });
                    }
                }
                return merged;
            }

            function renderHighlight(side, ranges) {
                const textarea = getTextarea(side);
                const layer = getHighlightLayer(side);
                const mergedRanges = mergeRanges(ranges, textarea.value.length);

                if (mergedRanges.length === 0) {
                    layer.innerHTML = '';
                    return;
                }

                let html = '';
                let cursor = 0;
                for (const range of mergedRanges) {
                    html += escapeHtml(textarea.value.slice(cursor, range.start));
                    html += `<mark>${escapeHtml(textarea.value.slice(range.start, range.end))}</mark>`;
                    cursor = range.end;
                }
                html += escapeHtml(textarea.value.slice(cursor));
                if (textarea.value.endsWith('\n')) {
                    html += ' ';
                }
                layer.innerHTML = html;
                syncHighlightScroll(side);
            }

            function clearHighlights() {
                activeSelectionSide = null;
                renderHighlight('source', []);
                renderHighlight('result', []);
            }

            function applySelectionHighlight(side) {
                const otherSide = getOtherSide(side);
                const textarea = getTextarea(side);

                if (textarea.selectionStart === textarea.selectionEnd) {
                    clearHighlights();
                    return;
                }

                activeSelectionSide = side;
                renderHighlight(side, []);
                renderHighlight(otherSide, getMatchedRanges(side));
            }

            function scheduleSelectionHighlight(side) {
                if (side === 'result' && isTranslating) {
                    autoScrollEnabled = false;
                }
                window.clearTimeout(selectionTimer);
                selectionTimer = window.setTimeout(() => {
                    applySelectionHighlight(side);
                }, 100);
            }

            function refreshActiveHighlight() {
                if (!activeSelectionSide) {
                    return;
                }
                applySelectionHighlight(activeSelectionSide);
            }

            function syncHighlightScroll(side) {
                const textarea = getTextarea(side);
                const layer = getHighlightLayer(side);
                layer.scrollTop = textarea.scrollTop;
                layer.scrollLeft = textarea.scrollLeft;
            }

            function handleTextChanged(side) {
                updateTextIndex(side);
                clearHighlights();
            }

        document.getElementById('targetLanguage').addEventListener('change', updateQuickLangButtons);

            sourceTextarea.addEventListener('input', () => handleTextChanged('source'));
            sourceTextarea.addEventListener('scroll', () => syncHighlightScroll('source'));
            resultTextarea.addEventListener('scroll', () => syncHighlightScroll('result'));
            sourceTextarea.addEventListener('select', () => scheduleSelectionHighlight('source'));
            resultTextarea.addEventListener('select', () => scheduleSelectionHighlight('result'));

            for (const eventName of ['mouseup', 'keyup', 'touchend']) {
                sourceTextarea.addEventListener(eventName, () => scheduleSelectionHighlight('source'));
                resultTextarea.addEventListener(eventName, () => scheduleSelectionHighlight('result'));
            }

            document.addEventListener('selectionchange', () => {
                if (document.activeElement === sourceTextarea) {
                    scheduleSelectionHighlight('source');
                } else if (document.activeElement === resultTextarea) {
                    scheduleSelectionHighlight('result');
                }
            });

            document.addEventListener('mousedown', (event) => {
                if (!event.target.closest('.text-match-box')) {
                    clearHighlights();
                }
            });

            resultTextarea.addEventListener('wheel', function() {
                if (isTranslating) {
                    autoScrollEnabled = false;
                }
            });

            updateAllTextIndexes();
            loadLanguages();
