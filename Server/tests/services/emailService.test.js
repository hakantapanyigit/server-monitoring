import sinon from "sinon";
import EmailService from "../../service/emailService.js";

describe("EmailService - Constructor", () => {
	let settingsServiceMock;
	let fsMock;
	let pathMock;
	let compileMock;
	let mjml2htmlMock;
	let nodemailerMock;
	let loggerMock;

	beforeEach(() => {
		settingsServiceMock = {
			getSettings: sinon.stub().returns({
				systemEmailHost: "smtp.example.com",
				systemEmailPort: 465,
				systemEmailAddress: "test@example.com",
				systemEmailPassword: "password",
			}),
		};

		fsMock = {
			readFileSync: sinon.stub().returns("<mjml><body></body></mjml>"),
		};

		pathMock = {
			join: sinon.stub().callsFake((...args) => args.join("/")),
		};

		compileMock = sinon.stub().returns(() => "<mjml><body></body></mjml>");

		mjml2htmlMock = sinon.stub().returns({ html: "<html></html>" });

		nodemailerMock = {
			createTransport: sinon.stub().returns({
				sendMail: sinon.stub().resolves({ messageId: "12345" }),
			}),
		};

		loggerMock = {
			error: sinon.stub(),
		};
	});

	afterEach(() => {
		sinon.restore();
	});

	it("should initialize template loaders and email transporter", () => {
		const emailService = new EmailService(
			settingsServiceMock,
			fsMock,
			pathMock,
			compileMock,
			mjml2htmlMock,
			nodemailerMock,
			loggerMock
		);

		// Verify that the settingsService is assigned correctly
		expect(emailService.settingsService).to.equal(settingsServiceMock);

		// Verify that the template loaders are initialized
		expect(emailService.templateLookup.welcomeEmailTemplate).to.be.a("function");
		expect(emailService.templateLookup.employeeActivationTemplate).to.be.a("function");

		// Verify that the email transporter is initialized
		expect(nodemailerMock.createTransport.calledOnce).to.be.true;
		const emailConfig = nodemailerMock.createTransport.getCall(0).args[0];
		expect(emailConfig).to.deep.equal({
			host: "smtp.example.com",
			port: 465,
			secure: true,
			auth: {
				user: "test@example.com",
				pass: "password",
			},
		});
	});

	it("should have undefined templates if FS fails", () => {
		fsMock = {
			readFileSync: sinon.stub().throws(new Error("File read error")),
		};
		const emailService = new EmailService(
			settingsServiceMock,
			fsMock,
			pathMock,
			compileMock,
			mjml2htmlMock,
			nodemailerMock,
			loggerMock
		);
		expect(loggerMock.error.called).to.be.true;
		const errorCalls = loggerMock.error.getCalls();
		const errorCall = errorCalls.find(
			(call) => call.args[0] === "Error loading Email templates"
		);
		expect(errorCall).to.not.be.undefined;
		expect(emailService.settingsService).to.equal(settingsServiceMock);
		expect(emailService.templateLookup.welcomeEmailTemplate).to.be.undefined;
		expect(emailService.templateLookup.employeeActivationTemplate).to.be.undefined;
	});
});

describe("EmailService - buildAndSendEmail", () => {
	let settingsServiceMock;
	let fsMock;
	let pathMock;
	let compileMock;
	let mjml2htmlMock;
	let nodemailerMock;
	let loggerMock;
	let emailService;
	beforeEach(() => {
		settingsServiceMock = {
			getSettings: sinon.stub().returns({
				systemEmailHost: "smtp.example.com",
				systemEmailPort: 465,
				systemEmailAddress: "test@example.com",
				systemEmailPassword: "password",
			}),
		};

		fsMock = {
			readFileSync: sinon.stub().returns("<mjml><body></body></mjml>"),
		};

		pathMock = {
			join: sinon.stub().callsFake((...args) => args.join("/")),
		};

		compileMock = sinon.stub().returns(() => "<mjml><body></body></mjml>");

		mjml2htmlMock = sinon.stub().returns({ html: "<html></html>" });

		nodemailerMock = {
			createTransport: sinon.stub().returns({
				sendMail: sinon.stub().resolves({ messageId: "12345" }),
			}),
		};

		loggerMock = {
			error: sinon.stub(),
		};

		emailService = new EmailService(
			settingsServiceMock,
			fsMock,
			pathMock,
			compileMock,
			mjml2htmlMock,
			nodemailerMock,
			loggerMock
		);
	});

	afterEach(() => {
		sinon.restore();
	});

	it("should build and send email successfully", async () => {
		const messageId = await emailService.buildAndSendEmail(
			"welcomeEmailTemplate",
			{},
			"recipient@example.com",
			"Welcome"
		);

		expect(messageId).to.equal("12345");
		expect(nodemailerMock.createTransport().sendMail.calledOnce).to.be.true;
	});

	it("should log error if building HTML fails", async () => {
		mjml2htmlMock.throws(new Error("MJML error"));

		const messageId = await emailService.buildAndSendEmail(
			"welcomeEmailTemplate",
			{},
			"recipient@example.com",
			"Welcome"
		);
		expect(loggerMock.error.calledOnce).to.be.true;
		expect(loggerMock.error.getCall(0).args[0]).to.equal("Error building Email HTML");
	});

	it("should log error if sending email fails", async () => {
		nodemailerMock.createTransport().sendMail.rejects(new Error("SMTP error"));
		await emailService.buildAndSendEmail(
			"welcomeEmailTemplate",
			{},
			"recipient@example.com",
			"Welcome"
		);
		expect(loggerMock.error.calledOnce).to.be.true;
		expect(loggerMock.error.getCall(0).args[0]).to.equal("Error sending Email");
	});

	it("should log error if both building HTML and sending email fail", async () => {
		mjml2htmlMock.throws(new Error("MJML error"));
		nodemailerMock.createTransport().sendMail.rejects(new Error("SMTP error"));

		const messageId = await emailService.buildAndSendEmail(
			"welcomeEmailTemplate",
			{},
			"recipient@example.com",
			"Welcome"
		);

		expect(messageId).to.be.undefined;
		expect(loggerMock.error.calledTwice).to.be.true;
		expect(loggerMock.error.getCall(0).args[0]).to.equal("Error building Email HTML");
		expect(loggerMock.error.getCall(1).args[0]).to.equal("Error sending Email");
	});

	it("should log an error if buildHtml fails", async () => {});
});
