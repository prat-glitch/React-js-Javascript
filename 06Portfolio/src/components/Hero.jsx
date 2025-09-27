import React from 'react';
import { Typography, Button, Container, Box } from '@mui/material';
import { Download as DownloadIcon, GitHub as GitHubIcon, LinkedIn as LinkedInIcon } from '@mui/icons-material';
import { motion } from 'framer-motion';

const Hero = () => {
  return (
    <section id="home" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float"></div>
        <div className="absolute top-40 right-20 w-72 h-72 bg-yellow-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute -bottom-8 left-40 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{ animationDelay: '4s' }}></div>
      </div>

      <Container maxWidth="lg" className="relative z-10">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Typography variant="h6" className="text-purple-300 mb-4 font-medium">
              Hello, I'm
            </Typography>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <Typography variant="h1" className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
              <span className="text-gradient">John Doe</span>
            </Typography>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <Typography variant="h4" className="text-xl md:text-2xl lg:text-3xl text-gray-300 mb-8 font-light">
              Full Stack Developer & UI/UX Designer
            </Typography>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <Typography variant="body1" className="text-gray-400 mb-12 max-w-2xl mx-auto text-lg leading-relaxed">
              I create beautiful, responsive web applications with modern technologies. 
              Passionate about clean code, user experience, and bringing ideas to life.
            </Typography>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8, type: "spring", stiffness: 100 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<DownloadIcon />}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-8 py-4 rounded-full text-white font-semibold shadow-lg hover:shadow-2xl transition-all duration-500"
              >
                Download CV
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outlined"
                size="large"
                className="border-purple-400 text-purple-300 hover:bg-purple-400/20 hover:border-purple-300 px-8 py-4 rounded-full font-semibold transition-all duration-500"
                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Get In Touch
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1, type: "spring" }}
            className="flex justify-center space-x-6"
          >
            <motion.a 
              href="#" 
              className="text-gray-400 hover:text-purple-400 transition-all duration-300 p-3 rounded-full hover:bg-white/10"
              whileHover={{ scale: 1.2, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
            >
              <GitHubIcon className="w-7 h-7" />
            </motion.a>
            <motion.a 
              href="#" 
              className="text-gray-400 hover:text-purple-400 transition-all duration-300 p-3 rounded-full hover:bg-white/10"
              whileHover={{ scale: 1.2, rotate: -5 }}
              whileTap={{ scale: 0.9 }}
            >
              <LinkedInIcon className="w-7 h-7" />
            </motion.a>
          </motion.div>
        </div>
      </Container>
    </section>
  );
};

export default Hero;

