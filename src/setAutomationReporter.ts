import { FullConfig, Reporter, Suite, TestCase } from '@playwright/test/reporter'
import * as azdev from 'azure-devops-node-api'
import { WebApi } from 'azure-devops-node-api'
import { IRequestOptions } from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces'
import { IWorkItemTrackingApi } from 'azure-devops-node-api/WorkItemTrackingApi'

export default class SetAutomationReporter implements Reporter {
	private connection!: WebApi
	private orgUrl!: string
	private token = ''
	private workItemApi!: IWorkItemTrackingApi
	private azureClientOptions = {
		allowRetries: true,
		maxRetries: 20
	} as IRequestOptions

	constructor(options: any) {
		this.orgUrl = options.orgUrl
		this.token = options.token
		this.connection = new azdev.WebApi(
			this.orgUrl,
			azdev.getPersonalAccessTokenHandler(this.token),
			this.azureClientOptions
		)
	}

	// eslint-disable-next-line no-unused-vars
	async onBegin(config: FullConfig, suite: Suite) {
		this.workItemApi = await this.connection.getWorkItemTrackingApi()
	}

	async onTestBegin(test: TestCase) {
		const caseIds = this._getCaseIds(test)
		if (!this.workItemApi) {
			this.workItemApi = await this.connection.getWorkItemTrackingApi()
		}
		if (caseIds.length === 0) {
			return
		}
		if (caseIds.length > 1) {
			throw new Error(`Found more than one test case id in test title: ${test.title}`)
		}

		const workItem = await this.workItemApi.getWorkItem(Number(caseIds[0]), ['Microsoft.VSTS.TCM.AutomationStatus'])

		if (workItem.fields?.['Microsoft.VSTS.TCM.AutomationStatus'] === 'Not Automated') {
			const patchDocument = [
				{
					op: 'add',
					path: '/fields/Microsoft.VSTS.TCM.AutomationStatus',
					value: 'Automated'
				}
			]
			await this.workItemApi.updateWorkItem({}, patchDocument, workItem.id as number)
		}
	}

	// eslint-disable-next-line no-unused-vars
	async onTestEnd(test: TestCase) {}

	async onEnd() {
		this._log('onEnd')
	}

	private _getCaseIds(test: TestCase): string[] {
		const result: string[] = []
		const regex = new RegExp(/\[([\d,\s]+)\]/, 'gm')
		const matchesAll = test.title.matchAll(regex)
		const matches = [...matchesAll].map((match) => match[1])
		matches.forEach((match) => {
			const ids = match.split(',').map((id) => id.trim())
			result.push(...ids)
		})
		return result
	}

	private _log(message: any) {
		console.log(`azure: ${message}`)
	}
}