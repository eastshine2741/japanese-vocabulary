package com.japanese.vocabulary.app.word.viewmodel

import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import com.japanese.vocabulary.app.word.dto.AddWordRequest
import com.japanese.vocabulary.app.word.dto.WordDefinitionDTO
import com.japanese.vocabulary.app.word.dto.WordListItem
import com.japanese.vocabulary.app.word.repository.VocabularyRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

sealed class LookupState {
    object Idle : LookupState()
    object Loading : LookupState()
    data class Success(val definition: WordDefinitionDTO) : LookupState()
    data class Error(val message: String) : LookupState()
}

sealed class AddState {
    object Idle : AddState()
    object Loading : AddState()
    data class Success(val id: Long) : AddState()
    data class Error(val message: String) : AddState()
}

sealed class WordListState {
    object Idle : WordListState()
    object Loading : WordListState()
    data class Success(
        val words: List<WordListItem>,
        val nextCursor: Long?,
        val isLoadingMore: Boolean = false
    ) : WordListState()
    data class Error(val message: String) : WordListState()
}

class VocabularyViewModel(private val repository: VocabularyRepository = VocabularyRepository()) {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    val lookupState: MutableState<LookupState> = mutableStateOf(LookupState.Idle)
    val addState: MutableState<AddState> = mutableStateOf(AddState.Idle)
    val wordListState: MutableState<WordListState> = mutableStateOf(WordListState.Idle)

    fun lookupWord(word: String) {
        lookupState.value = LookupState.Loading
        addState.value = AddState.Idle
        scope.launch {
            try {
                val definition = repository.lookupWord(word)
                lookupState.value = LookupState.Success(definition)
            } catch (e: Exception) {
                lookupState.value = LookupState.Error(e.message ?: "단어 조회 실패")
            }
        }
    }

    fun addWord(definition: WordDefinitionDTO, songId: Long, lyricLine: String) {
        addState.value = AddState.Loading
        scope.launch {
            try {
                val id = repository.addWord(
                    AddWordRequest(
                        japanese = definition.japanese,
                        reading = definition.reading,
                        koreanText = definition.meanings.joinToString(", "),
                        songId = songId,
                        lyricLine = lyricLine
                    )
                )
                addState.value = AddState.Success(id)
            } catch (e: Exception) {
                addState.value = AddState.Error(e.message ?: "단어 추가 실패")
            }
        }
    }

    fun loadWords(cursor: Long? = null) {
        wordListState.value = WordListState.Loading
        scope.launch {
            try {
                val response = repository.getWords(cursor)
                wordListState.value = WordListState.Success(
                    words = response.words,
                    nextCursor = response.nextCursor
                )
            } catch (e: Exception) {
                wordListState.value = WordListState.Error(e.message ?: "단어 목록 불러오기 실패")
            }
        }
    }

    fun loadMoreWords() {
        val current = wordListState.value as? WordListState.Success ?: return
        val cursor = current.nextCursor ?: return
        if (current.isLoadingMore) return
        wordListState.value = current.copy(isLoadingMore = true)
        scope.launch {
            try {
                val response = repository.getWords(cursor)
                val latest = wordListState.value as? WordListState.Success ?: return@launch
                wordListState.value = latest.copy(
                    words = latest.words + response.words,
                    nextCursor = response.nextCursor,
                    isLoadingMore = false
                )
            } catch (e: Exception) {
                wordListState.value = WordListState.Error(e.message ?: "단어 목록 불러오기 실패")
            }
        }
    }
}
