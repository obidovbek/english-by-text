# eSpeak-NG custom Uzbek corrections

Place your overrides in `./espeak-ng-data` and they will be mounted into the backend container at `/app/espeak-ng-data`.
The backend passes `--path /app/espeak-ng-data` to `espeak-ng` automatically if the directory exists.

## Layout

```
espeak-ng-data/
  voices/
    uzx            # e.g., corrected Uzbek voice definition (name: uz-Corrected)
  dictsource/
    uz_rules       # Uzbek spelling→phoneme rules
    uz_list        # Uzbek character mapping list
  phonemes/        # optional
```

## Compile dictionaries inside the container

```
docker compose up -d backend
# compile all (uses ESPEAK_DATA_PATH)
docker exec linguatext_backend espeak-ng --path /app/espeak-ng-data --compile
# or compile only Uzbek
docker exec linguatext_backend espeak-ng --path /app/espeak-ng-data --compile=uz
```

## Test

```
# IPA debug
docker exec linguatext_backend espeak-ng --path /app/espeak-ng-data -v uz-Corrected --ipa "Oʻrik, gʻisht, boʻy, oʻzing"
# Audio (stdout WAV)
docker exec linguatext_backend bash -lc 'espeak-ng --path /app/espeak-ng-data -v uz-Corrected --stdout "Oʻgʻil bugun maktabga bordi" > /tmp/uz.wav && ls -lh /tmp/uz.wav'
```
