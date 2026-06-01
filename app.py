import json
import os
import re
import streamlit as st
import time
import firebase_admin
from firebase_admin import credentials, firestore
from collections.abc import Mapping

# 1. FIREBASE BAĞLANTISI (Yalnızca bir kez başlatılır)
db = None
if not firebase_admin._apps:
    try:
        cred = None
        if "firebase" in st.secrets:
            firebase_secret = st.secrets["firebase"]
            if isinstance(firebase_secret, str):
                try:
                    firebase_secret = json.loads(firebase_secret)
                except json.JSONDecodeError:
                    try:
                        import ast
                        firebase_secret = ast.literal_eval(firebase_secret)
                    except Exception:
                        raise ValueError(
                            "st.secrets['firebase'] JSON veya dict formatında değil."
                        )
            if isinstance(firebase_secret, Mapping):
                firebase_secret = dict(firebase_secret)
                cred = credentials.Certificate(firebase_secret)
            else:
                raise ValueError(
                    "st.secrets['firebase'] geçerli bir dict ya da JSON string içermiyor."
                )
        elif os.environ.get("FIREBASE_CREDENTIALS"):
            cred = credentials.Certificate(json.loads(os.environ["FIREBASE_CREDENTIALS"]))
        elif os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            cred_path = os.environ["GOOGLE_APPLICATION_CREDENTIALS"]
            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
        elif os.path.exists("firebase_anahtar.json"):
            cred = credentials.Certificate("firebase_anahtar.json")

        if cred is None:
            raise FileNotFoundError(
                "Firebase kimlik bilgisi bulunamadı. Lütfen 'st.secrets', FIREBASE_CREDENTIALS env veya firebase_anahtar.json kullanın."
            )

        firebase_admin.initialize_app(cred)
    except Exception as e:
        st.error(f"Firebase anahtar dosyası bulunamadı veya hatalı: {e}")

if firebase_admin._apps:
    db = firestore.client()
else:
    db = None

if db is None:
    st.error(
        "Firebase bağlantısı kurulamadı. Lütfen kimlik bilgilerini kontrol edin ve deploy ortamınızda doğru Firebase anahtarını sağlayın."
    )
    st.stop()

# 2. YARDIMCI FONKSİYONLAR
def en_boy_harflendir(en_sayisi):
    harfler = []
    for i in range(en_sayisi):
        n = i
        harf_kombinasyonu = ""
        while n >= 0:
            harf_kombinasyonu = chr(n % 26 + 65) + harf_kombinasyonu
            n = n // 26 - 1
        harfler.append(harf_kombinasyonu)
    return harfler


def sanitize_streamlit_key(key):
    return re.sub(r'[^A-Za-z0-9_]+', '-', key)


def select_agac(agac_id):
    st.session_state.secili_agac = agac_id
    st.session_state.show_agac_modal = True
    st.session_state.sidebar_hidden = True


# Safely trigger a rerun across different Streamlit versions
def safe_rerun():
    if hasattr(st, "experimental_rerun"):
        st.experimental_rerun()
    elif hasattr(st, "rerun"):
        st.rerun()
    else:
        try:
            # Fallback: change query params to force Streamlit to rerun the script
            st.experimental_set_query_params(_rerun=str(time.time()))
        except Exception:
            # As a last resort, stop execution (user will need to interact to rerun)
            try:
                st.stop()
            except Exception:
                pass

# 3. STREAMLIT WEB ARAYÜZÜ AYARLARI
st.set_page_config(page_title="Tarla Takip Sistemi", layout="wide")



st.markdown(
    "<h1 style='text-align:center; margin-bottom: 0.25em;'>🚜 Çoklu Tarla ve Ağaç Bakım Yönetimi</h1>",
    unsafe_allow_html=True,
)

# Basit kullanıcı doğrulama - örnek kullanıcı: ömer / 4321
if "authenticated" not in st.session_state:
    st.session_state.authenticated = False
if "username" not in st.session_state:
    st.session_state.username = None

if not st.session_state.authenticated:
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.subheader("Giriş Yap")
        with st.form("login_form"):
            login_username = st.text_input("Kullanıcı adı:", value="")
            login_password = st.text_input("Şifre:", type="password")
            login_submit = st.form_submit_button("Giriş Yap")

        if login_submit:
            # Öncelikle Firestore 'users' koleksiyonunu kontrol et
            try:
                user_doc = db.collection("users").document(login_username).get()
                if user_doc.exists:
                    user_data = user_doc.to_dict() or {}
                    if user_data.get("password") == login_password:
                        st.session_state.authenticated = True
                        st.session_state.username = login_username
                        st.session_state.secili_tarla = None
                        st.session_state.secili_agac = None
                        st.session_state.show_agac_modal = False
                        st.success(f"{login_username} kullanıcı hesabıyla giriş yapıldı.")
                        safe_rerun()
                    else:
                        st.error("Hatalı kullanıcı adı veya şifre. Lütfen tekrar deneyin.")
                else:
                    # Fallback olarak sabit 'ömer' hesabını koru
                    if login_username == "ömer" and login_password == "4321":
                        st.session_state.authenticated = True
                        st.session_state.username = login_username
                        st.session_state.secili_tarla = None
                        st.session_state.secili_agac = None
                        st.session_state.show_agac_modal = False
                        st.success(f"{login_username} kullanıcı hesabıyla giriş yapıldı.")
                        safe_rerun()
                    else:
                        st.error("Hatalı kullanıcı adı veya şifre. Lütfen tekrar deneyin.")
            except Exception as e:
                st.error(f"Kullanıcı doğrulanırken hata oluştu: {e}")
        st.info("Tarla verileri kullanıcı bazında saklanır; başka bir kullanıcı kendi tarla listesini görür.")

        with st.expander("Yeni Kullanıcı Oluştur (Yetkili)"):
            st.write("Sadece özel kodu bilenler yeni kullanıcı oluşturabilir.")
            new_admin_code = st.text_input("Özel Kod:", type="password", key="expander_admin_code")
            new_user_name = st.text_input("Yeni Kullanıcı Adı:", key="expander_new_user")
            new_user_pass = st.text_input("Yeni Şifre:", type="password", key="expander_new_pass")
            if st.button("Kullanıcı Oluştur", key="expander_create_user"):
                if new_admin_code == "TARLAM":
                    if new_user_name and new_user_pass:
                        user_ref = db.collection("users").document(new_user_name)
                        try:
                            if user_ref.get().exists:
                                st.error("Bu kullanıcı zaten mevcut.")
                            else:
                                user_ref.set({"password": new_user_pass})
                                st.success(f"{new_user_name} kullanıcısı oluşturuldu.")
                        except Exception as e:
                            st.error(f"Kullanıcı oluşturulurken hata: {e}")
                    else:
                        st.error("Lütfen kullanıcı adı ve şifre girin.")
                else:
                    st.error("Geçersiz özel kod.")

    st.stop()

if "sidebar_hidden" not in st.session_state:
    st.session_state.sidebar_hidden = False

if st.session_state.sidebar_hidden:
    st.markdown(
        """<style>
        section.stSidebar { display: none !important; }
        div.stAppViewContainer { margin-left: 0 !important; }
        """,
        unsafe_allow_html=True,
    )

st.markdown(
    """<style>
    .stAppViewContainer > .main > .block-container {
        margin-left: auto !important;
        margin-right: auto !important;
        text-align: center !important;
        max-width: 1100px;
    }
    .stForm {
        margin-left: auto !important;
        margin-right: auto !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
    }
    .stForm .stButton > button {
        min-width: 180px !important;
    }
    .stButton>button {
        width: 100% !important;
        aspect-ratio: 1 / 1;
        padding: 2px 2px;
        margin-bottom: 0 !important;
        display: flex;
        align-items: center;
        justify-content: center;
        white-space: normal;
        min-height: 60px;
    }
    .stButton {
        margin-bottom: 0 !important;
    }
    .stButton>button>div {
        padding: 0 !important;
        margin: 0 !important;
    }
    .progress-bar-cell {
        margin-top: -17px !important;
        margin-bottom: 0 !important;
        padding: 0 !important;
    }
    .progress-bar-cell > div {
        margin: 0 !important;
    }
    </style>""",
    unsafe_allow_html=True,
)

# Firebase'den mevcut tarlaları çekme (sadece aktif kullanıcıya ait olanlar)
current_user = st.session_state.username
try:
    tarlalar_ref = db.collection("tarlalar").where("owner", "==", current_user).stream()
    tarlalar_listesi = [doc.id for doc in tarlalar_ref]
except Exception:
    tarlalar_listesi = []

    # --- YAN PANEL (Sidebar) ---
with st.sidebar:
    st.header("Tarla Yönetimi")

    # Tarla Seçimi
    if tarlalar_listesi:
        # If a pending selection was set by a previous action (e.g., after deletion), apply it BEFORE creating the widget
        if "_pending_secili_tarla" in st.session_state:
            pending = st.session_state.pop("_pending_secili_tarla")
            if pending is None:
                if "secili_tarla" in st.session_state:
                    del st.session_state["secili_tarla"]
            else:
                st.session_state["secili_tarla"] = pending

        # Use a session_state-backed selectbox so we can control selection after deletions
        st.selectbox("Aktif Tarla Seçin:", tarlalar_listesi, key="secili_tarla")
        secili_tarla = st.session_state.get("secili_tarla")
        if "secili_agac" not in st.session_state:
            st.session_state.secili_agac = None
        if "show_agac_modal" not in st.session_state:
            st.session_state.show_agac_modal = False

        params = getattr(st, "query_params", {})
        if params.get("select"):
            st.session_state.secili_agac = params.get("select")[0]
            st.session_state.show_agac_modal = True
    else:
        # Ensure session state does not keep an old selection
        if "secili_tarla" in st.session_state:
            del st.session_state["secili_tarla"]
        secili_tarla = None
        st.warning("Henüz kayıtlı tarla yok.")
        
    st.markdown("---")

    st.markdown(f"**👤 Kullanıcı:** {current_user}")
    if st.button("Çıkış Yap", key="logout_button"):
        st.session_state.authenticated = False
        st.session_state.username = None
        st.session_state["_pending_secili_tarla"] = None
        st.session_state.secili_agac = None
        st.session_state.show_agac_modal = False
        safe_rerun()

    # Yeni Tarla Ekleme Formu
    st.subheader("➕ Yeni Tarla Ekle")
    if "_pending_yeni_tarla_adi" in st.session_state:
        st.session_state["yeni_tarla_adi"] = st.session_state.pop("_pending_yeni_tarla_adi")

    yeni_tarla_adi = st.text_input("Tarla Adı:", placeholder="Örn: Güney Tarlası", key="yeni_tarla_adi")
    yeni_en = st.number_input("EN (Sıra/Harf Sayısı):", min_value=1, max_value=26, value=5)
    yeni_boy = st.number_input("BOY (Satır/Rakam Sayısı):", min_value=1, max_value=200, value=20)

    if st.button("Tarlayı Oluştur"):
        if yeni_tarla_adi and yeni_tarla_adi not in tarlalar_listesi:
            # Firebase'e yeni tarlayı ve boyutlarını kaydet
            db.collection("tarlalar").document(yeni_tarla_adi).set({
                "en": yeni_en,
                "boy": yeni_boy,
                "owner": current_user
            })
            st.session_state["_pending_secili_tarla"] = yeni_tarla_adi
            st.session_state["_pending_yeni_tarla_adi"] = ""
            st.session_state.secili_agac = None
            st.session_state.show_agac_modal = False
            st.success(f"'{yeni_tarla_adi}' başarıyla oluşturuldu ve seçildi!")
            safe_rerun()
        elif yeni_tarla_adi in tarlalar_listesi:
            st.error("Bu isimde bir tarla zaten var!")
        else:
            st.error("Lütfen geçerli bir tarla adı girin.")
    # Tarla Silme Bölümü
    st.markdown("---")
    st.subheader("🗑️ Tarla Sil")
    if secili_tarla:
        st.write(f"Seçili Tarla: **{secili_tarla}**")
        # Tek adımda güvenli onay: checkbox işaretlenince silme butonu görünür
        confirm = st.checkbox(f"'{secili_tarla}' tarlasını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.", key=f"confirm_sil_{secili_tarla}")
        if confirm:
            if st.button("Onayla ve Sil", key=f"sil_onay_{secili_tarla}"):
                tarla_ref = db.collection("tarlalar").document(secili_tarla)
                try:
                    if not tarla_ref.get().exists:
                        st.error("Tarla verisi bulunamadı veya zaten silinmiş.")
                    else:
                        # Alt koleksiyonu varsa sil (her belgeyi ayrı ayrı)
                        try:
                            agaclar_ref = tarla_ref.collection("agaclar").stream()
                            for doc in agaclar_ref:
                                tarla_ref.collection("agaclar").document(doc.id).delete()
                        except Exception:
                            pass

                        tarla_ref.delete()
                        # Güncel tarla listesini tekrar çek ve seçimi güncelle
                        try:
                            kalan_tarlalar = [d.id for d in db.collection("tarlalar").stream()]
                        except Exception:
                            kalan_tarlalar = []

                        if kalan_tarlalar:
                            # Can't modify widget-backed key after widget creation; set a pending value and rerun
                            st.session_state["_pending_secili_tarla"] = kalan_tarlalar[0]
                        else:
                            # Signal that there should be no selection
                            st.session_state["_pending_secili_tarla"] = None

                        st.success(f"'{secili_tarla}' tarlası silindi. Sayfa güncelleniyor.")
                        safe_rerun()
                except Exception as e:
                    st.error(f"Tarla silinirken hata oluştu: {e}")
    else:
        st.info("Silmek için önce bir tarla seçin.")

# --- ANA EKRAN ---
if secili_tarla:
    # Seçilen tarlanın boyutlarını Firebase'den al (önce belgenin varlığını kontrol et)
    tarla_snapshot = db.collection("tarlalar").document(secili_tarla).get()
    if not tarla_snapshot.exists:
        st.error("Seçili tarla verisi bulunamadı. Otomatik olarak başka bir tarla seçiliyor veya lütfen yeni bir tarla oluşturun.")
        try:
            kalan_tarlalar = [d.id for d in db.collection("tarlalar").stream()]
        except Exception:
            kalan_tarlalar = []

        if kalan_tarlalar:
            # Defer changing the widget-backed key until the selectbox is (re)created
            st.session_state["_pending_secili_tarla"] = kalan_tarlalar[0]
            safe_rerun()
        else:
            st.session_state["_pending_secili_tarla"] = None
            safe_rerun()
    else:
        tarla_doc = tarla_snapshot.to_dict() or {}
        en = int(tarla_doc.get("en", 0))
        boy = int(tarla_doc.get("boy", 0))

        if en <= 0 or boy <= 0:
            st.error("Tarla boyut bilgileri eksik veya hatalı. Lütfen tarla ayarlarını kontrol edin.")
        else:
            center1, center2, center3 = st.columns([1, 2, 1])
            with center2:
                st.subheader(f"📍 {secili_tarla} Haritası ({en}x{boy})")
                st.info("Detaylarını görmek veya düzenlemek istediğiniz ağacın butonuna tıklayın.")

            harfler = en_boy_harflendir(en)
            agaclar_ref = db.collection("tarlalar").document(secili_tarla).collection("agaclar").stream()
            agaclar_data = {doc.id: doc.to_dict() for doc in agaclar_ref}

            button_css = ["<style>"]
            styled_buttons = set()

            if "secili_agac" not in st.session_state:
                st.session_state.secili_agac = None
            if "show_agac_modal" not in st.session_state:
                st.session_state.show_agac_modal = False

            if st.session_state.sidebar_hidden:
                st.markdown(
                    """<style>
                    section.stSidebar { display: none !important; }
                    div.stAppViewContainer { margin-left: 0 !important; }
                    .st-key-show_sidebar button {
                        position: fixed !important;
                        top: 76px !important;
                        right: 86px !important;
                        width: 88px !important;
                        height: 88px !important;
                        border-radius: 50% !important;
                        background: #333 !important;
                        color: #fff !important;
                        box-shadow: 0 8px 20px rgba(0,0,0,0.25) !important;
                        z-index: 9999 !important;
                        font-size: 52px !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                    }
                    .st-key-show_sidebar button:hover {
                        background: #555 !important;
                    }
                    """,
                    unsafe_allow_html=True,
                )
                if st.button("☰", key="show_sidebar", help="Sidebar'ı geri getir"):
                    st.session_state.sidebar_hidden = False
                    safe_rerun()

            main_col, detail_col = st.columns([4, 1])

            with main_col:
                cols = st.columns(en)
                for sutun_index, harf in enumerate(harfler):
                    with cols[sutun_index]:
                        st.write(f"**{harf}**")
                        for satir in range(1, boy + 1):
                            agac_id = f"{harf}{satir}"
                            agac_data = agaclar_data.get(agac_id, {})
                            bakim_puani = agac_data.get("bakim_puani", 0)
                            try:
                                bakim_puani = int(bakim_puani)
                            except Exception:
                                bakim_puani = 0
                            bakim_puani = max(0, min(100, bakim_puani))

                            # renk eşlemesi
                            if bakim_puani == 0:
                                cell_color = "#000000"
                                text_color = "#ffffff"
                            elif 1 <= bakim_puani <= 9:
                                cell_color = "#ff0000"
                                text_color = "#ffffff"
                            elif 10 <= bakim_puani <= 29:
                                cell_color = "#ffff00"
                                text_color = "#000000"
                            elif 30 <= bakim_puani <= 49:
                                cell_color = "#ff9800"
                                text_color = "#000000"
                            elif 50 <= bakim_puani <= 69:
                                cell_color = "#2b24ad"
                                text_color = "#ffffff"
                            elif 70 <= bakim_puani <= 89:
                                cell_color = "#ff00ff"
                                text_color = "#ffffff"
                            else:
                                cell_color = "#4caf50"
                                text_color = "#ffffff"

                            if agac_id not in styled_buttons:
                                key_for_button = f"btn_{secili_tarla}_{agac_id}"
                                sanitized_key = sanitize_streamlit_key(key_for_button)
                                button_css.append(
                                    f'.st-key-{sanitized_key} button {{ background: {cell_color} !important; color: {text_color} !important; border-color: rgba(255,255,255,0.2) !important; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08) !important; }}'
                                )
                                styled_buttons.add(agac_id)

                            st.button(
                                agac_id,
                                key=f"btn_{secili_tarla}_{agac_id}",
                                use_container_width=True,
                                on_click=select_agac,
                                args=(agac_id,),
                            )

                            st.markdown(
                                f"<div class='progress-bar-cell' style='width:100%; background:#e0e0e0; border-radius:4px; height:10px; margin-top:2px;'>"
                                f"<div style='width:{bakim_puani}%; background:{cell_color}; height:100%; border-radius:4px;'></div></div>",
                                unsafe_allow_html=True,
                            )

            button_css.append("</style>")
            st.markdown("\n".join(button_css), unsafe_allow_html=True)

            with detail_col:
                st.markdown("### Ağaç Bakım Paneli")
                if st.session_state.show_agac_modal and st.session_state.secili_agac:
                    st.markdown(f"**Seçili Ağaç:** {st.session_state.secili_agac}")
                    agac_ref = db.collection("tarlalar").document(secili_tarla).collection("agaclar").document(st.session_state.secili_agac).get()
                    agac_verisi = agac_ref.to_dict() if agac_ref.exists else {"bakim_puani": 0, "ilaclama": "", "notlar": ""}

                    bakim_puani_default = agac_verisi.get("bakim_puani", 0)
                    try:
                        bakim_puani_default = int(bakim_puani_default)
                    except Exception:
                        bakim_puani_default = 0

                    with st.form(key=f"agac_form_{secili_tarla}_{st.session_state.secili_agac}"):
                        yeni_bakim_puani = st.number_input("Bakım Puanı (0-100):", min_value=0, max_value=100, value=bakim_puani_default)
                        yeni_ilaclama = st.text_input("Son İlaçlama / Gübreleme:", value=agac_verisi.get("ilaclama", ""))
                        yeni_notlar = st.text_area("Genel Notlar:", value=agac_verisi.get("notlar", ""), height=180)
                        kaydet = st.form_submit_button("Kaydet")
                        temizle = st.form_submit_button("Temizle")
                        kapat = st.form_submit_button("Kapat")

                    if kaydet:
                        db.collection("tarlalar").document(secili_tarla).collection("agaclar").document(st.session_state.secili_agac).set({
                            "bakim_puani": yeni_bakim_puani,
                            "ilaclama": yeni_ilaclama,
                            "notlar": yeni_notlar
                        })
                        st.success(f"{st.session_state.secili_agac} verileri başarıyla kaydedildi!")
                        safe_rerun()
                    if temizle:
                        db.collection("tarlalar").document(secili_tarla).collection("agaclar").document(st.session_state.secili_agac).set({
                            "bakim_puani": 0,
                            "ilaclama": "",
                            "notlar": ""
                        })
                        st.success(f"{st.session_state.secili_agac} verisi temizlendi.")
                        safe_rerun()
                    if kapat:
                        st.session_state.show_agac_modal = False
                else:
                    st.info("Bir ağaç seçin, detay formu burada açılacak.")
else:
    st.info("Lütfen sol menüyü kullanarak bir tarla seçin veya yeni bir tarla oluşturun.")
