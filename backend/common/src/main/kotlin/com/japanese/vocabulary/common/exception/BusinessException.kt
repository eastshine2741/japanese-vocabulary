package com.japanese.vocabulary.common.exception

class BusinessException(val errorCode: ErrorCode) : RuntimeException(errorCode.message)
