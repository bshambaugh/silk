package controllers.workspaceApi

import java.util.logging.Logger

import controllers.core.RequestUserContextAction
import controllers.core.util.ControllerUtilsTrait
import javax.inject.Inject
import org.silkframework.config.DefaultConfig
import play.api.libs.json.{Format, JsArray, JsString, Json}
import play.api.mvc.{Action, AnyContent, InjectedController, Request}

import scala.collection.JavaConverters._

/**
  * API endpoints for initialization of the frontend application.
  */
case class InitApi @Inject()() extends InjectedController with ControllerUtilsTrait {
  private val dmConfigKey = "eccencaDataManager.baseUrl"
  private val dmLinksKey = "eccencaDataManager.moduleLinks"
  private val dmLinkPath = "path"
  private val dmLinkIcon = "icon"
  private val dmLinkDefaultLabel = "defaultLabel"
  private lazy val cfg = DefaultConfig.instance()
  private val log: Logger = Logger.getLogger(getClass.getName)

  def init(): Action[AnyContent] = RequestUserContextAction { request => implicit userContext =>
    val emptyWorkspace = workspace.projects.isEmpty
    val resultJson = Json.obj(
      "emptyWorkspace" -> emptyWorkspace,
      "initialLanguage" -> initialLanguage(request)
    )
    val withDmUrl = dmBaseUrl.map { url =>
      resultJson + ("dmBaseUrl" -> url) + ("dmModuleLinks" -> JsArray(dmLinks.map(Json.toJson(_))))
    }.getOrElse(resultJson)
    Ok(withDmUrl)
  }

  val supportedLanguages = Set("en", "de")

  /** The initial UI language, extracted from the accept-language header. */
  private def initialLanguage(request: Request[AnyContent]): String = {
    request.acceptLanguages.foreach(lang => {
      val countryCode = lang.code.take(2).toLowerCase
      if(supportedLanguages.contains(countryCode)) {
        return countryCode
      }
    })
    "en" // default
  }

  /** Manually configured links into DM modules. */
  lazy val dmLinks: Seq[DmLink] = {
    if(cfg.hasPath(dmLinksKey)) {
      val linkConfig = cfg.getConfigList(dmLinksKey)
      var result: Vector[DmLink] = Vector.empty
      for(link <- linkConfig.asScala) {
        if(link.hasPath(dmLinkPath) && link.hasPath(dmLinkDefaultLabel)) {
          var icon: Option[String] = None
          if(link.hasPath(dmLinkIcon)) {
            icon = Some(link.getString(dmLinkIcon))
          }
          result :+= DmLink(link.getString(dmLinkPath).stripPrefix("/"), link.getString(dmLinkDefaultLabel), icon)
        } else {
          log.warning(s"Invalid entries in DM module links. Check '$dmLinksKey' in your config. Each link entry needs a '$dmLinkPath' and " +
              s"'$dmLinkDefaultLabel' value.")
        }
      }
      result
    } else {
      Seq.empty
    }
  }

  private def dmBaseUrl: Option[JsString] = {
    if(cfg.hasPath(dmConfigKey)) {
      Some(JsString(cfg.getString(dmConfigKey)))
    } else {
      None
    }
  }

  case class DmLink(path: String, defaultLabel: String, icon: Option[String])

  object DmLink {
    implicit val dmLinkFormat: Format[DmLink] = Json.format[DmLink]
  }
}
