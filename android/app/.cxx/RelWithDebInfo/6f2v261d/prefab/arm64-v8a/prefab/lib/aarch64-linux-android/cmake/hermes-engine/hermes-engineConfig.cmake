if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "/Users/shivm/.gradle/caches/transforms-3/41a0c4f824140eab43f152055d9140bf/transformed/jetified-hermes-android-0.73.6-0-release/prefab/modules/libhermes/libs/android.arm64-v8a/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/shivm/.gradle/caches/transforms-3/41a0c4f824140eab43f152055d9140bf/transformed/jetified-hermes-android-0.73.6-0-release/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

