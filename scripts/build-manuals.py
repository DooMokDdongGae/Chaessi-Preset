"""Build the four bundled guides from screenshots of the real app. No network calls."""
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import ImageReader
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'manuals'
SCREENS = OUT / 'screenshots'
pdfmetrics.registerFont(TTFont('Guide', 'C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('GuideBold', 'C:/Windows/Fonts/malgunbd.ttf'))
W, H = 595.28, 841.89
INK = HexColor('#17253a'); MUTED = HexColor('#506078'); BLUE = HexColor('#166b9a')
STYLE = ParagraphStyle('body', fontName='Guide', fontSize=11, leading=17, textColor=INK, wordWrap='CJK')

# Each page has one clear task, a real screenshot, and short numbered steps.
# Buttons retain their exact on-screen names, including in the Korean guide.
APP = [
 ('시작하기: 그림을 만드는 도구 상자', 'Start here: your image toolbox', 'preset-editor.png',
  ['Chaessi Preset은 NovelAI로 보낼 그림 설명과 설정을 모아 두는 앱입니다. 프리셋은 다시 꺼내 쓰는 설정 꾸러미입니다.', '이 설명서는 3.4.0 화면을 사용합니다. 화면의 버튼 이름은 영어이므로, 설명에서도 같은 이름을 씁니다.', '처음에는 API Settings 설정 후 Base prompt를 쓰고 Generate One Image를 누르세요. 자세한 순서는 다음 쪽에 있습니다.'],
  ['Chaessi Preset keeps the description and settings you send to NovelAI. A preset is a saved bundle you can use again.', 'This guide uses version 3.4.0. Button names match the app, so you can find them easily.', 'Start with API Settings, write a Base prompt, then click Generate One Image. The next pages show each step.']),
 ('1. NovelAI 연결하기', '1. Connect to NovelAI', 'api-settings.png',
  ['상단 API Settings를 누릅니다. NovelAI 계정에서 준비한 API 토큰을 NovelAI Token 칸에 붙여 넣습니다.', 'Save Token을 누릅니다. 데스크톱 앱은 토큰을 암호화해서 저장합니다. 토큰을 다른 사람에게 보여 주지 마세요.', 'Refresh Token Status로 상태를 확인합니다. 401 Unauthorized가 나오면 토큰이 유효한지 다시 확인하세요.', '그림 생성은 NovelAI 계정의 Anlas나 Stamina를 사용할 수 있습니다. 상단 잔액을 확인하세요.'],
  ['Click API Settings at the top. Paste the API token from your NovelAI account into NovelAI Token.', 'Click Save Token. The desktop app encrypts the saved token. Keep it private.', 'Click Refresh Token Status. If you see 401 Unauthorized, check that your token is valid.', 'Generating can use your NovelAI Anlas or Stamina. Check the balance at the top.']),
 ('2. 원하는 그림을 말로 쓰기', '2. Describe your picture', 'preset-editor.png',
  ['Name에는 나중에 찾기 쉬운 이름을 적습니다. 예: 파란 셔츠 소녀.', 'Base prompt에는 원하는 것을 적습니다. 예: 1girl, blue shirt, standing, simple background', 'Undesired에는 덜 나오게 하고 싶은 것을 적습니다. 예: blurry, text', '같은 프롬프트라도 결과가 달라질 수 있습니다. 한 번에 한 가지씩 바꾸며 비교하세요.'],
  ['Give Name a label you will recognize later, such as Blue shirt girl.', 'Write what you want in Base prompt. Try: 1girl, blue shirt, standing, simple background', 'Write things you want less of in Undesired. Try: blurry, text', 'Results can vary with the same prompt. Change one thing at a time and compare.']),
 ('3. 그림 설정 고르기', '3. Choose image settings', 'settings.png',
  ['Model에서 V4.5 Full 또는 V5 Full을 고릅니다. 모델별 설정은 따로 기억합니다.', 'Width는 가로, Height는 세로 크기입니다. 처음에는 기본 크기와 Steps를 사용하세요.', 'Seed를 비워 두면 새 Seed를 사용합니다. 숫자를 고정하면 같은 설정을 비교하기 쉽지만, Wildcard는 계속 새로 선택합니다.', 'Quality Tags는 품질 문구, UC preset은 원치 않는 결과를 줄이는 기본 문구입니다. 토큰 경고가 나오면 설명을 짧게 줄이세요.'],
  ['Choose V4.5 Full or V5 Full in Model. The app remembers settings separately for each model.', 'Width is the image width; Height is its height. Start with the default size and Steps.', 'An empty Seed uses a new seed. A fixed number helps compare settings, but Wildcards still choose again.', 'Quality Tags add quality hints. UC preset adds common unwanted-content hints. Shorten your text if a token warning appears.']),
 ('4. 첫 이미지 만들기', '4. Make your first image', 'generation.png',
  ['Text to Image를 선택하고 Generate One Image를 한 번 누릅니다.', 'Generating 표시가 끝날 때까지 기다립니다. 완료되면 그림과 설정 요약이 나타납니다.', 'Selected prompt for this request를 펼치면 이번 요청에서 선택한 프롬프트를 볼 수 있습니다.', 'Save로 이미지를 저장할 수 있습니다. 생성한 결과는 History에도 남습니다. 실패하면 오류 문구를 확인하고 다시 시도하세요.'],
  ['Choose Text to Image and click Generate One Image once.', 'Wait for Generating to finish. The image and its settings appear when it succeeds.', 'Open Selected prompt for this request to see the prompt selected for that request.', 'Use Save to save the image. Successful results also appear in History. If it fails, read the error before trying again.']),
 ('5. 프리셋 저장하고 불러오기', '5. Save and load presets', 'preset-library.png',
  ['Current Preset의 Save는 현재 꾸러미를 저장합니다. Save As는 새 꾸러미로 저장합니다. Load는 저장한 전체 꾸러미를 엽니다.', 'Base prompt 옆 Preset은 Base와 Undesired용 라이브러리를 엽니다. 카드의 Load를 누르면 내용과 실제 이름이 적용됩니다.', '카테고리와 하위 카테고리로 찾을 수 있습니다. 남성 의상과 여성 의상 하위 목록은 한국어 가나다순입니다.', '프리셋에 __tops__를 저장하면 다음에도 Wildcard를 사용할 수 있습니다. 후보 목록은 Wildcards에서 따로 관리합니다.'],
  ['Save in Current Preset stores the current bundle. Save As creates another bundle. Load opens a saved full preset.', 'Preset beside Base prompt opens the Base and Undesired library. Click a card\'s Load to apply its content and real name.', 'Use category and subcategory filters to find entries. Male and female clothing subcategories use Korean alphabetical order.', 'Save __tops__ in a preset to keep using a Wildcard. Manage its candidate list separately in Wildcards.']),
 ('6. 캐릭터를 따로 설명하기', '6. Describe characters separately', 'characters.png',
  ['Add Character를 누릅니다. 그 인물의 머리, 옷, 표정 등을 Prompt에 적습니다.', 'Undesired Content 탭에는 그 캐릭터에서 줄이고 싶은 것을 적습니다. On/Off로 생성에 포함할지 고릅니다.', 'Up/Down으로 순서를 바꾸고 Preset으로 캐릭터 설명을 저장하거나 불러옵니다. Delete는 그 슬롯을 지웁니다.', 'V4.5는 최대 6명, V5는 최대 32명입니다. Base는 공통 장면, Character는 개별 인물을 설명하면 편합니다.'],
  ['Click Add Character. Write that person\'s hair, clothes, or expression in Prompt.', 'Use Undesired Content for things to reduce for that character. On/Off chooses whether to include it.', 'Use Up/Down to reorder and Preset to save or load a character description. Delete removes that slot.', 'V4.5 supports up to 6 characters; V5 supports up to 32. Use Base for the shared scene and Character for each person.']),
 ('7. V5 인물 위치 고르기', '7. Position characters in V5', 'v5-position.png',
  ['V5 Full에서 Character Position을 Custom으로 바꾸면 Position Pad가 나타납니다.', '번호가 붙은 점을 드래그해서 인물을 놓을 위치를 고릅니다. 번호는 Character 순서입니다.', 'AI\'s Choice는 모델이 위치를 고르게 합니다. Advanced의 X/Y는 0에서 1 사이 좌표입니다.', '점이 겹치면 안내가 나타납니다. Reset selected to center로 선택한 점을 가운데로 되돌릴 수 있습니다. 위치는 그림에서 완벽히 보장되지는 않습니다.'],
  ['In V5 Full, change Character Position to Custom to show the Position Pad.', 'Drag a numbered marker to choose a character\'s location. The number follows Character order.', 'AI\'s Choice lets the model choose. Advanced X/Y values are coordinates between 0 and 1.', 'An overlap notice appears when markers are close. Reset selected to center moves the selected marker back. Image placement is a hint, not a guarantee.']),
 ('8. 이미지를 가져와 사용하기', '8. Bring an image into the app', 'image-intake.png',
  ['Open Image로 PNG, JPG 또는 WebP를 엽니다. 파일을 앱에 끌어 놓거나 이미지를 붙여 넣어도 됩니다.', 'Image to Image는 원본을 참고해 새 그림을 만듭니다. Inpaint는 칠한 부분을 다시 그립니다.', 'Precise Reference는 V4.5에서 인물이나 스타일을 참고합니다. V5에서는 지원하지 않습니다.', 'NovelAI 정보가 있는 이미지라면 Import Selected Metadata로 프롬프트나 설정을 가져올 수 있습니다. 이미지를 고르는 것만으로 설정이 바뀌지는 않습니다.'],
  ['Use Open Image for PNG, JPG, or WebP. You can also drop a file into the app or paste an image.', 'Image to Image makes a new image from a source. Inpaint redraws the painted area.', 'Precise Reference uses character or style references in V4.5. It is not supported in V5.', 'If the image has NovelAI metadata, use Import Selected Metadata to bring in text or settings. Choosing an image alone does not import them.']),
 ('9. 원본을 참고해 다시 그리기', '9. Redraw using a source image', ['image-to-image.png', 'i2i-controls.png'],
  ['이미지 입력창에서 Image to Image를 고르면 원본 미리보기가 나타납니다.', '프롬프트에는 새로 원하는 모습을 적습니다. Strength는 원본을 얼마나 바꿀지 조절합니다. 처음에는 작은 변화부터 비교하세요.', 'Noise는 원본에 더하는 변화를 조절합니다. 모델별 기본값을 먼저 사용하세요.', 'Generate One Image를 누릅니다. 원본을 바꾸고 싶다면 다른 파일을 넣거나 History 결과를 원본으로 사용하세요.'],
  ['Choose Image to Image in image intake. A source preview appears.', 'Describe the new result in your prompt. Strength controls how much the image changes. Start with small changes.', 'Noise controls additional changes to the source. Start with the model\'s default value.', 'Click Generate One Image. Load another file or reuse a History result to change the source.']),
 ('10. 일부만 고치기와 참고 이미지', '10. Fix one area and use references', ['inpaint.png', 'inpaint-controls.png'],
  ['Inpaint에서 원본을 넣고 바꾸고 싶은 부분을 브러시로 칠합니다. 칠하지 않은 부분은 유지하도록 요청합니다.', '프롬프트를 적고 Generate One Image를 누릅니다. 아무 곳도 칠하지 않으면 먼저 마스크를 만들라는 오류가 납니다.', 'V4.5 Precise Reference는 Add Reference로 이미지를 추가합니다. 인물/스타일, Strength, Fidelity를 고릅니다.', '참고 이미지나 설정에 따라 비용이 달라질 수 있습니다. 생성 전에 화면의 비용 안내를 확인하세요.'],
  ['In Inpaint, load the source and paint the area you want to change. Unpainted areas are requested to stay.', 'Write the prompt and click Generate One Image. If you paint nothing, the app asks for a mask first.', 'For V4.5 Precise Reference, click Add Reference. Choose character/style, Strength, and Fidelity.', 'References and settings can change the cost. Read the cost notice before generating.']),
 ('11. History와 도움말 찾기', '11. Find results and help', 'history.png',
  ['History의 View 또는 그림을 누르면 크게 볼 수 있습니다. 이전/다음 버튼이나 좌우 화살표로 다른 결과를 봅니다.', 'Reuse로 확정된 프롬프트와 설정을 불러오거나 결과를 I2I/Inpaint 원본으로 사용할 수 있습니다. Wildcard는 그 이미지에서 선택된 값으로 불러옵니다.', 'Select to delete로 여러 기록을 고를 수 있습니다. 삭제 확인 후에는 이미지와 관련 파일이 함께 지워집니다. 먼저 필요한 이미지를 저장하세요.', '상단 v3.4.0 버튼을 누르면 App info & Manuals가 열립니다. 전체 앱과 Wildcard 설명서의 한국어/영어 PDF를 바로 열 수 있습니다.'],
  ['Click View or a History image to enlarge it. Use previous/next buttons or Left/Right keys to browse.', 'Use Reuse to load the final prompt and settings, or use the image as an I2I/Inpaint source. Wildcards load as the values used for that image.', 'Select to delete lets you choose several records. Confirmed deletion removes images and related files. Save images you want first.', 'Click v3.4.0 at the top for App info & Manuals. Open the app and Wildcard guides in Korean or English directly.']),
]
WILDCARD = [
 ('Wildcard: 후보를 모아 두는 상자', 'Wildcards: a box of choices', 'wildcard-library.png',
  ['Wildcard는 여러 그림 설명을 넣어 두는 상자입니다. 예를 들어 tops에는 white shirt, blue shirt 같은 상의 설명을 넣습니다.', '이미지를 생성할 때 상자에서 후보 하나를 같은 확률로 고릅니다. 후보가 수백 개여도 전체 목록을 사용합니다.', '한 번 골랐던 후보가 다시 나올 수 있습니다. 같은 확률은 번갈아 쓰기와 다릅니다. 이 버전은 균등 랜덤 방식입니다.'],
  ['A Wildcard is a box of prompt choices. For example, tops can contain white shirt and blue shirt.', 'Each generation picks one candidate with an equal chance. Even a list with hundreds of entries uses the full list.', 'The same choice can appear again. Equal chance does not mean taking turns. This version uses independent random selection.']),
 ('1. 새 Wildcard 만들기', '1. Create a Wildcard', ['wildcard-key.png', 'wildcard-candidates.png'],
  ['상단 Wildcards를 누르고 + New Wildcard를 누릅니다.', 'Name에는 알아보기 쉬운 이름을, Reference key에는 tops 같은 짧은 키를 적습니다. 키는 소문자 영어, 숫자, 단일 밑줄, 하이픈을 쓸 수 있습니다.', 'Candidates에 한 줄당 후보 하나를 적습니다. white shirt와 blue shirt는 서로 다른 줄에 적으세요.', 'Save를 누릅니다. 빈 줄과 같은 후보의 중복 줄은 제거됩니다. 저장 후 키는 고정되지만 이름과 후보는 바꿀 수 있습니다.'],
  ['Click Wildcards at the top, then + New Wildcard.', 'Use a friendly Name and a short Reference key, such as tops. Keys use lowercase letters, numbers, single underscores, or hyphens.', 'Write one candidate per line in Candidates. Put white shirt and blue shirt on separate lines.', 'Click Save. Empty and duplicate lines are removed. The saved key stays fixed; the name and candidates can change.']),
 ('2. 많은 후보 관리하기', '2. Manage a large list', 'wildcard-tools.png',
  ['왼쪽 목록에서 Wildcard를 선택합니다. Search로 이름이나 키를 찾습니다.', '여러 줄을 한꺼번에 붙여 넣거나 Import TXT로 UTF-8 텍스트 파일을 엽니다. 가져온 뒤 Save를 눌러야 저장됩니다.', 'Export TXT는 현재 편집한 후보를 텍스트 파일로 저장합니다. Sample은 시험으로 하나를 보여 줍니다. 생성에 사용할 값을 고정하지는 않습니다.', 'Delete는 후보 상자를 지웁니다. 그 키를 쓰는 프리셋은 새 상자를 준비하거나 참조를 고쳐야 생성할 수 있습니다.'],
  ['Select a Wildcard in the left list. Search finds a name or key.', 'Paste many lines at once, or use Import TXT for a UTF-8 text file. Click Save after importing.', 'Export TXT saves the current candidate text. Sample shows a practice choice; it does not lock the choice for generation.', 'Delete removes the box. Presets using its key need a replacement box or an edited reference before generating.']),
 ('3. 프롬프트에 넣기', '3. Insert it into a prompt', 'wildcard-insert.png',
  ['Base prompt에서 넣고 싶은 위치에 커서를 둡니다. 그 칸의 Wildcard 버튼을 누릅니다.', '목록에서 tops를 고르고 Insert into prompt를 누릅니다. 프롬프트에 __tops__가 들어갑니다. 밑줄은 앞뒤에 두 개씩입니다.', '예: 1girl, __tops__, standing. 후보 목록 전체를 붙여 넣을 필요가 없습니다.', 'Undesired와 Character의 현재 Prompt/Undesired 탭에서도 같은 방법을 사용합니다. 직접 __tops__를 입력해도 됩니다.'],
  ['Place the cursor where you want the reference in Base prompt. Click that field\'s Wildcard button.', 'Choose tops, then Insert into prompt. The app inserts __tops__. There are two underscores on each side.', 'Example: 1girl, __tops__, standing. You do not need to paste the whole candidate list.', 'Use the same method for Undesired or the active Character Prompt/Undesired tab. You can also type __tops__ yourself.']),
 ('4. 여러 상자와 기존 랜덤 함께 쓰기', '4. Combine boxes and random blocks', 'preset-editor.png',
  ['상의용 tops와 자세용 poses를 따로 만들어 보세요. 예: 1girl, __tops__, __poses__, ||indoors|outdoors||', '각 참조가 나타날 때마다 따로 하나를 고릅니다. 같은 __tops__를 두 번 쓰면 서로 다른 옷이 선택될 수 있습니다.', '후보 한 줄에 white shirt, rolled sleeves처럼 여러 태그를 넣으면 그 줄 전체가 하나의 후보입니다.', '후보 안에는 ||white shirt|blue shirt||를 쓸 수 있습니다. 다른 Wildcard를 넣는 중첩은 지원하지 않습니다.'],
  ['Create tops for clothes and poses for poses. Try: 1girl, __tops__, __poses__, ||indoors|outdoors||', 'Each reference chooses independently. Two uses of __tops__ can choose different clothes.', 'A line such as white shirt, rolled sleeves is one candidate, including all its tags.', 'A candidate can use ||white shirt|blue shirt||. References to another Wildcard inside a candidate are not supported.']),
 ('5. 저장하고 이미지 생성하기', '5. Save and generate', 'selected-prompt.png',
  ['Current Preset의 Save 또는 Save As로 프리셋을 저장합니다. 프리셋에는 __tops__ 같은 참조가 남습니다.', 'Generate One Image를 누르면 앱이 후보와 기존 랜덤 블록을 확정하고 NovelAI에 보냅니다.', 'Selected prompt for this request를 펼치면 실제로 선택된 단어를 봅니다. 편집창의 __tops__는 다음 생성에서도 쓸 수 있게 남습니다.', 'Wildcard를 수정하면 다음 생성부터 저장된 새 목록을 사용합니다. 이미 준비된 요청은 처음 선택한 값을 유지합니다.'],
  ['Save or Save As in Current Preset stores the preset. References such as __tops__ remain in it.', 'Click Generate One Image. The app resolves the choices and existing random blocks before sending them to NovelAI.', 'Open Selected prompt for this request to see the chosen words. __tops__ remains in the editor for the next image.', 'Saved Wildcard edits apply to the next generation. A request already prepared keeps its original choices.']),
 ('6. 결과 확인과 문제 해결', '6. Check results and solve problems', 'history.png',
  ['History와 생성 이미지의 NovelAI 메타데이터에는 그 이미지에서 사용한 확정 프롬프트가 남습니다. 전체 후보 목록은 넣지 않습니다.', 'History 설정을 불러오면 blue shirt처럼 확정된 값이 들어옵니다. 다시 랜덤으로 만들려면 원본 프리셋을 Load하세요.', 'missing or empty 오류가 나오면 키 철자와 저장 여부를 확인하세요. 키의 대소문자와 밑줄 개수를 확인하세요.', '다른 컴퓨터로 옮길 때는 프리셋과 함께 각 Wildcard의 TXT도 옮깁니다. 같은 키로 다시 만들어 Save하세요. 설명서는 상단 버전 버튼에서 다시 열 수 있습니다.'],
  ['History and the image\'s NovelAI metadata keep the final prompt used for that image. They do not include the candidate library.', 'Loading History settings gives fixed values such as blue shirt. Load the original preset to choose randomly again.', 'For a missing or empty error, check the key spelling and whether you saved the list. Check letter case and both pairs of underscores.', 'When moving to another computer, bring each Wildcard TXT file with the preset. Create and save the same keys there. Reopen this guide from the version button.']),
]
APP.append(('12. 설명서 다시 열기', '12. Reopen the guides', 'about.png',
 ['상단의 v3.4.0 버튼을 누릅니다. App info & Manuals 창이 열립니다.', 'App guide는 전체 앱 설명서입니다. Wildcard guide는 후보 목록 기능만 설명합니다.', '한국어 PDF 또는 English PDF를 누르면 설명서가 새 창에 열립니다. 인터넷에서 파일을 찾을 필요가 없습니다.', 'PDF 창에서 확대하거나 저장할 수 있습니다. 설명서 창을 닫으면 앱에서 계속 작업할 수 있습니다.'],
 ['Click v3.4.0 at the top to open App info & Manuals.', 'App guide explains the whole app. Wildcard guide focuses on candidate lists.', 'Click 한국어 PDF or English PDF. The bundled guide opens in a new window; you do not need to find a file online.', 'Zoom or save from the PDF viewer. Close the guide window to continue in the app.']))

def text(c, value, y, size=11, bold=False, color=INK):
    style = ParagraphStyle('local', parent=STYLE, fontSize=size, leading=size*1.55, fontName='GuideBold' if bold else 'Guide', textColor=color)
    p = Paragraph(escape(value), style)
    _, height = p.wrap(W-84, H)
    p.drawOn(c, 42, y-height)
    return y-height

def build(kind, lang, pages):
    title = ('Chaessi Preset 사용 설명서' if kind == 'app' else 'Wildcard 사용 설명서') if lang == 'ko' else ('Chaessi Preset User Guide' if kind == 'app' else 'Wildcard User Guide')
    file = OUT / f'{kind}-{lang}.pdf'
    c = canvas.Canvas(str(file), pagesize=(W,H), pageCompression=1)
    c.setTitle(title + ' - 3.4.0'); c.setAuthor('Chaessi Preset'); c.setSubject('Illustrated guide with actual app screenshots')
    for number, (ko, en, image, ko_steps, en_steps) in enumerate(pages, 1):
        c.setFillColor(HexColor('#e8f3fa')); c.rect(0, H-100, W, 100, fill=1, stroke=0)
        text(c, f'{title}  |  3.4.0', H-23, 9, color=BLUE)
        text(c, ko if lang == 'ko' else en, H-45, 20, bold=True)
        c.bookmarkPage(f'p{number}'); c.addOutlineEntry(ko if lang == 'ko' else en, f'p{number}', 0)
        top = H-115
        images = image if isinstance(image, list) else [image]
        for filename in images:
            image_path = SCREENS / filename
            if not image_path.exists(): raise FileNotFoundError(f'Real app screenshot missing: {image_path}')
            reader = ImageReader(str(image_path)); iw, ih = reader.getSize()
            scale = min((W-84)/iw, (320 if len(images)==1 else 150)/ih)
            dw, dh = iw*scale, ih*scale
            c.setFillColor(HexColor('#0b0f16')); c.roundRect((W-dw)/2-4, top-dh-4, dw+8, dh+8, 5, fill=1, stroke=0)
            c.drawImage(reader, (W-dw)/2, top-dh, dw, dh)
            top -= dh + 12
        caption = '실제 앱 화면. 설명의 버튼 이름을 화면에서 찾아보세요.' if lang == 'ko' else 'Actual app screen. Match the button names in the steps below.'
        y = text(c, caption, top-2, 8, color=MUTED)-15
        for i, step in enumerate(ko_steps if lang == 'ko' else en_steps, 1):
            y = text(c, f'{i}. {step}', y)-11
        if y < 47: raise ValueError(f'Page overflow: {file.name} page {number}, y={y}')
        c.setStrokeColor(HexColor('#d6e1eb')); c.line(42, 37, W-42, 37)
        c.setFont('Guide', 8); c.setFillColor(MUTED)
        c.drawString(42, 23, 'Chaessi Preset 3.4.0'); c.drawRightString(W-42, 23, f'{number} / {len(pages)}')
        c.showPage()
    c.save()
    pdf = PdfReader(file)
    assert len(pdf.pages) == len(pages)
    assert all(len(page.extract_text()) > 100 for page in pdf.pages)
    print(f'{file.name}: {len(pdf.pages)} pages, {file.stat().st_size:,} bytes')

for kind, pages in [('app', APP), ('wildcard', WILDCARD)]:
    for lang in ['ko', 'en']: build(kind, lang, pages)
