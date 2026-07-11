if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "/Users/shivm/.gradle/caches/transforms-3/139e637d5c49957f4f23963343866f6e/transformed/jetified-hermes-android-0.73.6-0-debug/prefab/modules/libhermes/libs/android.x86_64/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/shivm/.gradle/caches/transforms-3/139e637d5c49957f4f23963343866f6e/transformed/jetified-hermes-android-0.73.6-0-debug/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

