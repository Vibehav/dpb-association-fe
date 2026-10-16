package expo.modules.whatsappshare

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WhatsAppNotInstalledException : CodedException("WhatsApp is not installed on this phone.")

/**
 * Hands a PDF to WhatsApp, aimed at one number, in a **single** launch.
 *
 * `react-native-share` launched WhatsApp twice when given a number — the chat first, the file
 * 10 ms later — and Android 10+ drops the second launch because our app is in the background
 * by then, so the chat opened empty. Here the file and the number travel in one intent, started
 * from the current (foreground) activity.
 *
 * `jid` is WhatsApp's own, undocumented extra. It opens the chat directly when the number is in
 * the phone's contacts; otherwise WhatsApp shows its picker — with the PDF still attached.
 */
class WhatsAppShareModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WhatsAppShare")

    /** `contentUri`: a content:// link to the PDF. `phone`: country code + number, digits only. */
    AsyncFunction("sharePdf") { contentUri: String, phone: String ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val uri = Uri.parse(contentUri)
      val intent = Intent(Intent.ACTION_SEND).apply {
        setPackage("com.whatsapp")
        type = "application/pdf"
        putExtra(Intent.EXTRA_STREAM, uri)
        // ClipData carries the read grant to the receiving app on current Android.
        clipData = ClipData.newRawUri(null, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        putExtra("jid", "$phone@s.whatsapp.net")
      }
      try {
        activity.startActivity(intent)
      } catch (e: ActivityNotFoundException) {
        throw WhatsAppNotInstalledException()
      }
    }.runOnQueue(Queues.MAIN)
  }
}
