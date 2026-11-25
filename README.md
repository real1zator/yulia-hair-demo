# Юлия · студия волос

[Открыть демо](https://real1zator.github.io/yulia-hair-demo/)

Интерактивная 3D-примерка с вращением, наклоном, масштабированием и восемью оттенками, калькулятор и тестовая запись. Заявки сохраняются в браузере.

Анатомическая модель адаптирована из [Riley от Innerscene](https://www.innerscene.com/tools/library/3d-parts/riley-3d-person-woman-standing-8d40398f), CC0. Для волос использована сетка long01 из [MakeHuman](https://download.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html), CC0, с геометрией из [CharacterCreator](https://github.com/kblood/CharacterCreator/blob/master/LICENSE-NOTES.md). Сетка подогнана под модель. Длина, текстура и цвет меняются во время примерки.

В режиме «На модели» сцену можно вращать и приближать мышью или жестами. В режиме «На себе» MediaPipe Face Landmarker отслеживает поворот, наклон и масштаб лица, а Three.js отрисовывает объёмные пряди поверх видео. Камера включается по запросу и требует HTTPS или localhost. Кадры обрабатываются в браузере и никуда не отправляются. [Документация MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js)

В проект включён MediaPipe Tasks Vision 0.10.32 и модель Face Landmarker. Анимация сайта использует GSAP. Изображения главного экрана и галереи сгенерированы для демо.